# Feed: filtros, busca, histórico e ações rápidas — design

Data: 2026-11-20 · Status: aprovado

## Por quê

O feed deve ser curto e focado no que é novo e interessa, sem perder nada que valha a pena: filtrar rápido
por categoria/canal, buscar sem sair da tela inicial, não ver gravações de live, ver o que já assistiu e
retomar de onde parou, e salvar para depois com um toque.

## Objetivos

1. **Gravações de live ignoradas no app todo** (feed, busca, canal, playlists, histórico, `/watch/[id]`).
   A sincronização continua gravando-as no banco (sem custo extra), mas a regra única de visibilidade
   (`visibleVideoCondition`) passa a exigir `is_live_recording = false`. O selo "Gravação de live" sai.
2. **Feed com janela de 14 dias** pela data de publicação, aplicada na consulta (`listFeed`).
   `FEED_WINDOW_DAYS` passa de 30 para 14. Busca, canal, playlists e histórico não têm janela.
   Assistido continua aos 90% (`WATCHED_RATIO`) e o vídeo sai do feed.
3. **Busca na tela inicial**: campo no topo do feed; `/?q=…` mostra os resultados no lugar do feed, com ✕
   para limpar. Escopo: todos os vídeos visíveis de canais ativos (como a busca atual). A aba "Busca" sai da
   navegação; `/search` redireciona para `/` mantendo `q`.
4. **Filtros multisseleção**:
   - Categorias em chips que alternam (vários ao mesmo tempo, OU entre eles). "Todos" limpa. Atualiza na hora.
   - Canais em menu suspenso com o visual do `Select` do app, miniatura + nome, caixas de seleção (OU entre
     eles), item "Limpar seleção". O gatilho mostra "Todos os canais" / avatar + nome / avatares sobrepostos +
     "N canais". Com categorias marcadas, o menu lista só os canais delas e canais fora delas saem da seleção.
     Aplica ao fechar o menu.
   - Estado na URL: `/?categoria=1,3&canal=UCa,UCb`. Ids inválidos são ignorados.
   - Os filtros não se aplicam à busca (a busca ocupa a tela; os filtros ficam ocultos enquanto há `q`).
5. **Histórico** (`/history`, aba "Histórico" no lugar de "Busca"):
   - "Continuar assistindo": começados (`position_seconds > 0`) e não assistidos, mais recentes primeiro.
   - "Assistidos": `watched = true`, por `updated_at` desc. Paginação com "Carregar mais".
   - Abrir um vídeo já retoma da posição salva (comportamento existente).
6. **Ações rápidas no card**:
   - Desktop (hover): ícone 🕒 "Assistir depois" (alterna; destacado quando salvo) em todos os cards e
     👁 "Dispensar" só no feed.
   - Celular (sem hover): botão ⋮ com menu: "Salvar para assistir depois" / "Remover de Assistir depois" e
     "Dispensar do feed" (só no feed).
   - O card recebe `savedForLater` da consulta (existe item na playlist "Assistir depois").

## Fora do escopo

Remover itens do histórico; tirar automaticamente do "Assistir depois" um vídeo assistido; filtros na busca.

## Abordagens consideradas

- **Filtro de canais**: Radix Select (padrão do app) não suporta multisseleção → escolhido Radix
  DropdownMenu com `CheckboxItem`, estilizado igual ao `Select`. Chips de canal descartados (muitos canais).
  Combobox com busca descartado (mais peso, sem pedido).
- **Live**: filtrar na visibilidade (escolhido) vs. não gravar no sync (exigiria mudar classificação, testes de
  sync e limpeza de dados; nenhum ganho visível).
- **Janela de 14 dias**: na consulta (escolhido, vídeos saem do feed com o tempo) vs. só no `in_feed` na
  importação (não faria vídeos antigos saírem).

## Decisões do implementador (minhas)

- Nova dependência `@radix-ui/react-dropdown-menu` (menu ⋮ e filtro de canais).
- Rota `/history` (rotas do app são em inglês); rótulo "Histórico".
- Filtro de canais aplica ao fechar; chips aplicam na hora.
