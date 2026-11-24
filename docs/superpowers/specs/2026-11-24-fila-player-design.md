# Fila de vídeos e controles do player — design

Data: 2026-11-24 · Branch base: `feat/feed-filtros-historico`

## Intenção

Poder montar uma **fila de vídeos** e assistir em sequência sem sair do clima (inclusive em tela cheia), com
controles de anterior/próximo no centro do player. De quebra: legendas desligadas por padrão, menos botões
inúteis na barra (±10 s) e integração com teclado, fone e tela de bloqueio.

## Objetivos

1. Fila persistida **no servidor** (mesma fila no PC e no celular).
2. Botões ⏮ / ⏭ **ao lado do play central**, ativos só quando há para onde ir.
3. Troca de vídeo **dentro do mesmo player** (a tela cheia sobrevive à troca).
4. **Reprodução automática** opcional: ligada → contagem regressiva na tela final e avança; desligada → só o botão
   "Próximo".
5. Legendas **desligadas por padrão**, com botão **CC** para ligar (a escolha é lembrada).
6. Remover os botões de ±10 s da barra.
7. Extras escolhidos: painel da fila (reordenar/remover), "Tocar a seguir" e "Adicionar à fila" nos cards,
   playlist inteira na fila (e `?list=` usando os mesmos ⏮/⏭), vídeo sai da fila ao ser tocado, atalhos
   Shift+N / Shift+P, teclas de mídia / tela de bloqueio (Media Session).

## Não-objetivos

- **Seleção de qualidade**: impossível — o YouTube ignora `setPlaybackQuality` desde 2019 e
  `getAvailableQualityLevels()` vem vazio no player embutido. Fica registrado, sem implementação.
- Várias filas nomeadas, embaralhar, repetir.
- Modo cinema (não escolhido).
- Picture-in-picture (não dá com iframe).

## Anti-objetivos (seria falha mesmo "funcionando")

- Player piscando/recarregando o iframe a cada vídeo da fila, ou sair da tela cheia ao avançar.
- Tocar áudio escondido depois de sair da página de vídeo.
- A fila ficar inconsistente entre aparelhos (ex.: o anterior/próximo apontar para um vídeo já removido).
- Legendas voltando a aparecer sozinhas.

## Restrições

- Next 16.4.6 (App Router, sem Cache Components — confirmado em `next.config.ts`). Pela doc local
  (`node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`), **layouts preservam estado e
  não remontam na navegação**: ir de `/watch/a` para `/watch/b` mantém montado o que estiver em
  `app/(app)/watch/layout.tsx`. É isso que viabiliza a abordagem B.
- App de um usuário só; Postgres + Drizzle; server actions com `requireSession()`; testes de queries com PGlite
  (`tests/lib/queries/*`).
- Player atual usa a IFrame API sem controles do YouTube; tudo é nosso ([Player.tsx](../../../src/components/Player.tsx)).

## Abordagens consideradas

| | Como | Troca |
|---|---|---|
| A. Navegar de página | ⏮/⏭ fazem `router.push('/watch/x')`; o `Player` (com `key={id}`) remonta. | Simples, segue o padrão atual; **mas a tela cheia fecha a cada vídeo** e o iframe recarrega. |
| **B. Mesmo player (escolhida)** | O player sobe para um layout `watch/layout.tsx` que persiste; a página só informa "qual vídeo" e renderiza os detalhes no servidor; o player chama `loadVideoById`. | Tela cheia sobrevive, transição sem piscar. Mais estado no cliente e um contrato entre página e layout. |
| B'. Página toda no cliente | Trocar URL com `history.pushState` e buscar dados do vídeo por action. | Descartada: perde a renderização no servidor dos detalhes e duplica lógica. |

**Escolhida: B** (decisão do usuário, motivo: manter tela cheia entre vídeos).

## Design

### 1. Modelo de dados — tabela `queue_items`

```
queue_items
  video_id   text PK  → videos.id ON DELETE CASCADE
  position   integer NOT NULL          -- ordem dos "próximos"
  played_at  timestamptz NULL          -- NULL = ainda na fila; preenchido = já tocado (pilha do "anterior")
  added_at   timestamptz NOT NULL DEFAULT now()
```

- **Próximos** = `played_at IS NULL ORDER BY position`.
- **Tocados** = `played_at IS NOT NULL ORDER BY played_at DESC` (pilha escondida, só serve ao ⏮).
- Um vídeo aparece no máximo uma vez (PK). Adicionar um vídeo que já está na fila o **move** (para o fim, ou para
  a frente no "Tocar a seguir"); adicionar um já tocado o tira da pilha e o põe de volta nos próximos.
- Pilha de tocados limitada a 50 (os mais antigos são apagados ao marcar um novo como tocado).
- Migração Drizzle nova em `drizzle/`.

### 2. Regras da fila (funções puras/queries em `src/lib/queries/queue.ts`, testadas)

- `enqueue(videoIds[], mode: "end" | "next")`: "end" = depois do último; "next" = antes do primeiro próximo
  (`min(position) - 1`), preservando a ordem do lote.
- `remove(videoId)`, `reorder(videoId, newIndex)`, `clear()` (apaga próximos **e** tocados).
- `startPlaying(videoId)`: chamado quando um vídeo passa a ser o atual (aberto por link, ⏭, painel ou autoplay).
  Se ele está nos próximos → marca `played_at = now()` (**sai do painel**). Se já é o topo da pilha → nada.
  Se não está na fila → nada (vídeo avulso).
- `neighbors(currentId)` → `{ prev, next }`:
  - `next` = primeiro dos próximos (diferente do atual).
  - `prev` = topo da pilha de tocados, ignorando o próprio atual.
- `goBack(currentId)`: o atual, se estava na pilha, volta para **a frente dos próximos** (`played_at = NULL`,
  `position = min - 1`); retorna o `prev` (que permanece na pilha como topo). Assim ⏮ ⏭ ⏮ é reversível.
- `replaceWithPlaylist(playlistId)`: "Tocar tudo" — limpa a fila e enfileira a playlist na ordem dela.

### 3. Contexto de navegação: fila × playlist (`?list=`)

- Com `?list=<id>` na URL: ⏮/⏭ seguem a **ordem da playlist** (anterior/próximo item dela; `getNextInPlaylist`
  ganha um irmão `getPrevInPlaylist`), mantendo `?list=` no link. A fila não é tocada.
- Sem `?list=`: ⏮/⏭ seguem a fila (seção 2).
- O vídeo atual, sem `?list=`, chama `startPlaying` ao começar a tocar.

### 4. Arquitetura do player persistente (abordagem B)

- Novo `src/app/(app)/watch/layout.tsx` (servidor) renderiza `<WatchShell>{children}</WatchShell>` dentro de
  `max-w-5xl`. `WatchShell` (cliente) mantém um **contexto** "vídeo atual" e renderiza o `Player` acima de
  `children`.
- `watch/[id]/page.tsx` deixa de renderizar o `Player`; em vez disso renderiza `<NowPlaying video={...}
  prev={...} next={...} />` (cliente, sem UI) que publica no contexto: id, duração, `startAt`, thumbnail,
  `embeddable`, links de prev/next. Título, canal, botões, descrição e painel continuam renderizados no servidor.
- `Player` deixa de usar `key={videoId}`: cria o `YT.Player` **uma vez** e, quando o id do contexto muda, chama
  `loadVideoById({ videoId, startSeconds })`, salva o progresso do vídeo anterior antes, e reseta estado
  local (tempo, buffer, fim, erro). Tela cheia (nativa ou de página) é preservada.
- ⏮/⏭/autoplay/Shift+N/P/teclas de mídia fazem `router.push(href)` (sem rolar a página: `{ scroll: false }`).
  A página nova renderiza no servidor, `NowPlaying` publica o novo vídeo, o player troca. Botão "voltar" do
  navegador funciona naturalmente (é navegação normal).
- Vídeo não incorporável ou com erro: o shell mostra o fallback atual ("Abrir no YouTube"), mas ⏮/⏭ continuam
  disponíveis na tela de fallback para seguir a fila.
- Ao sair de `/watch` o layout desmonta e o player é destruído (sem áudio fantasma — não há Cache Components).

### 5. Controles do player

- **Centro**: trio ⏮ ▶/⏸ ⏭ visível sempre que os controles estão visíveis (hoje só o ▶ aparece, e só pausado).
  ⏮/⏭ desabilitados (esmaecidos, `aria-disabled`) sem destino. No toque: o trio aparece com o toque simples
  que já mostra os controles.
- **Barra inferior**: remove os botões ±10 s. Mantém atalhos j/l/setas e o toque duplo nas laterais.
  Adiciona botão **CC** e o **switch de reprodução automática** (este só quando há `next`).
- **Atalhos**: Shift+N → próximo, Shift+P → anterior (em `shortcutFor`, testado).
- **Media Session**: `navigator.mediaSession` com metadata (título, canal, thumbnail) e handlers
  `previoustrack`/`nexttrack`/`play`/`pause`; handlers removidos/nulos quando não há destino. Best-effort: o
  iframe do YouTube pode disputar a sessão — verificar no navegador; se não funcionar de forma confiável, fica
  documentado e sem regressão.

### 6. Legendas

- Ao ficar pronto e a cada `PLAYING`, se a preferência `zt.captions` for 0 (padrão), chamar
  `player.unloadModule("captions")` (e `"cc"` para players antigos). Também passar `cc_load_policy: 0`.
- Botão CC: liga → `loadModule("captions")`; desliga → `unloadModule`. Preferência em localStorage (por aparelho,
  como volume/velocidade).
- `loadModule/unloadModule` não estão na tipagem atual: adicionar como opcionais em `YTPlayer` e checar
  existência antes de chamar.

### 7. Fim do vídeo e reprodução automática

- Preferência `zt.autoplay` (localStorage, padrão **ligado**).
- `EndScreen` recebe `next` (href + título + thumb). Ligado: contagem de 5 s com "Cancelar" e "Tocar agora";
  ao zerar faz `router.push(next)`. Desligado ou cancelado: botão "Próximo" (texto "Próximo da fila" /
  "Próximo da playlist").
- Em tela cheia, a tela final é mostrada **dentro** do container de tela cheia (hoje ela sai da tela cheia de
  página); para o autoplay seguir em tela cheia.

### 8. Interface da fila

- **Cards** (`CardActions`): "Adicionar à fila" e "Tocar a seguir" (ícones no hover; itens no menu ⋮ no toque).
- **Tela do vídeo**: botão "Adicionar à fila" junto de Assistido/Assistir depois/Playlist.
- **Painel da fila** na tela de vídeo (`QueuePanel`): lista dos próximos com miniatura, título, canal; remover;
  reordenar por arrastar (Pointer Events + botões ↑/↓ acessíveis por teclado — sem dependência nova);
  "Limpar fila". No desktop largo (`lg`), coluna à direita do conteúdo; no estreito, abaixo dos botões. Em modo
  `?list=` o painel mostra a playlist (somente leitura, item atual destacado).
- **Página `/queue`** com o mesmo painel e botão "Reproduzir fila" (vai para o primeiro próximo). Entrada pelo
  menu lateral (desktop, com contador) e por um cartão "Fila" no topo de `/playlists` (celular, onde a barra
  inferior já tem 5 itens).
- **Playlist**: botões "Tocar tudo" (substitui a fila e começa) e "Adicionar à fila" no cabeçalho. Se a fila tiver
  itens, "Tocar tudo" pede confirmação (dialog Radix já existente).
- Ações em `src/app/(app)/queue/actions.ts` com `requireSession()` + `revalidatePath`.

## Decisões minhas (para o usuário conferir)

- Pilha do "anterior" no estilo Spotify (seção 2) — consequência de "sai da fila ao tocar" + ⏮.
- "Sai da fila" acontece quando o vídeo **começa a tocar**, não ao terminar.
- Autoplay e CC são preferências **por aparelho**; autoplay vem ligado.
- Mantidos atalhos j/l/setas e toque duplo, apesar da remoção dos botões ±10 s.
- Página `/queue` + cartão em `/playlists` como acesso no celular.
- Reordenar sem biblioteca nova.
- `?list=` tem precedência sobre a fila.

## Fica para quem implementar

- Nomes exatos de componentes e a divisão interna do `Player` (pode extrair o trio central e o `EndScreen`).
- Visual do painel e do switch de autoplay, seguindo os tokens atuais (pílulas, cantos 14px, acento azul).
- Estratégia de reposicionamento de `position` (inteiros com renumeração ocasional basta).
- Testes: queries da fila (PGlite), `shortcutFor` (Shift+N/P), regras de `neighbors`/`goBack`; verificação do
  player no navegador (troca sem remontar, tela cheia mantida, CC, autoplay).
