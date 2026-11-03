# ZamparTube — Documento de design

Data: 2026-11-03
Status: aprovado (2026-11-03)

## 1. Intenção (o porquê)

O ZamparTube é um "YouTube pessoal" para um único usuário (o dono do projeto). Ele mostra **apenas** vídeos de canais escolhidos pelo usuário.

O objetivo é usar o YouTube sem cair em conteúdo fútil empurrado pelo algoritmo. Sucesso é: abrir o app, ver o que saiu de novo nos canais escolhidos, assistir o que interessa e **fechar**, sem rolagem infinita e sem sugestões externas.

## 2. Objetivos

- Feed só com vídeos dos canais cadastrados.
- Reproduzir vídeos dentro do app, pelo player oficial do YouTube (iframe).
- Gerenciar canais pela interface: adicionar colando link, `@handle` ou ID do canal, e remover.
- Organizar canais em **categorias** (ex.: "Programação", "Finanças") e filtrar o feed por categoria.
- **Feed com fim:** mostra os vídeos novos e não assistidos e termina com uma mensagem do tipo "Você está em dia". Sem rolagem infinita.
- **Marcar como assistido:** vídeos assistidos saem do feed principal. Marcação manual e também automática (ver 6.4).
- **Continuar de onde parei:** salvar a posição de reprodução de cada vídeo e retomar dali.
- **Playlists pessoais:** criar, renomear, apagar, adicionar e remover vídeos, e reordenar.
- **Assistir depois:** uma playlist especial que já vem criada e não pode ser apagada.
- **Busca** nos vídeos já salvos no banco (título e descrição), sem gastar cota da API.
- **Atualização automática** diária pela Vercel Cron, mais um botão "Atualizar agora".
- Funcionar bem no computador e no celular (responsivo), instalável na tela inicial (PWA).
- Tema **escuro** com **azul** como cor de destaque.
- **Lives:** mostrar só as **gravações de lives já encerradas** (decisão do usuário). Lives acontecendo agora e transmissões agendadas não aparecem.

## 3. Não-objetivos (fora desta versão)

- Vários usuários, cadastro ou contas.
- Login com Google (OAuth) e sincronização com playlists ou inscrições reais do YouTube.
- Comentários, curtidas e inscrições do YouTube.
- App nativo publicado em loja.
- Busca no YouTube inteiro (fora dos canais cadastrados).

## 4. Anti-objetivos (o que tornaria o projeto um fracasso mesmo funcionando)

- **Qualquer Short aparecendo, em qualquer lugar** (feed, busca, página do canal, playlists). Exigência explícita do usuário: "NÃO QUERO SHORTS DE JEITO NENHUM".
- Recomendações, "vídeos relacionados", "Em alta" ou qualquer conteúdo de fora dos canais cadastrados.
- Rolagem infinita no feed principal.
- Autoplay do próximo vídeo.
- Identidade visual que imite o YouTube (nome, logo, vermelho). As regras da API proíbem isso, e o usuário quer azul.

## 5. Restrições

- **Hospedagem:** Vercel (decisão do usuário). Plano Hobby: Vercel Cron no máximo 1x por dia.
- **Banco:** Neon (PostgreSQL), decisão do usuário.
- **YouTube Data API v3** com chave de API (o usuário já tem). Cota padrão: 10.000 unidades/dia.
  - `channels.list`, `playlistItems.list` e `videos.list` custam 1 unidade por chamada (até 50 itens).
  - `search.list` custa 100 unidades: **não usar**.
- **Termos do YouTube:** reprodução só pelo player oficial incorporado. Não baixar vídeo nem remover anúncios ou a marca do player. Não usar "YouTube" no nome nem a identidade visual do YouTube.
- A chave da API fica **só no servidor** (variável de ambiente). Nunca vai para o navegador.
- O usuário vai validar o resultado final, não cada passo. O app precisa ser simples de configurar e de publicar.

## 6. Decisões de como construir

### 6.1 Stack (decisão minha, delegada pelo usuário)

- **Next.js (App Router) + TypeScript**, publicado na Vercel.
- **Tailwind CSS** no visual.
- **Drizzle ORM** com o driver serverless do Neon (`@neondatabase/serverless`).
- **Migrations** com drizzle-kit.
- Chamadas à API do YouTube feitas por um módulo do servidor com `fetch` simples. Não usar o SDK `googleapis`, que é pesado.

### 6.2 Proteção de acesso (decisão minha)

Como o site fica público na Vercel, uma **senha única** em variável de ambiente (`APP_PASSWORD`) protege tudo. Uma tela de login cria um cookie de sessão assinado (`SESSION_SECRET`), httpOnly, com validade longa (ex.: 90 dias). Um middleware bloqueia todas as rotas e APIs sem sessão válida. A exceção é a rota do cron, que é protegida pelo `CRON_SECRET` da Vercel.

### 6.3 Como os vídeos entram no banco (sincronização)

- **Adicionar canal:** resolver a entrada (link, `@handle` ou ID `UC...`) com `channels.list` (`forHandle` ou `id`). Salvar nome, avatar, ID do canal e ID da playlist de uploads.
- **Listar vídeos sem Shorts:** usar a playlist de **vídeos longos** do canal, que tem o ID do canal com o prefixo `UC` trocado por `UULF`. Por exemplo, `UCabc...` vira `UULFabc...`. Essa playlist já exclui Shorts e lives (as gravações de lives vêm de outra playlist, ver abaixo).
  - **Atenção:** esse recurso funciona há anos, mas não está na documentação oficial. Por isso existe a verificação abaixo.
- **Gravações de lives:** a playlist `UULF` não inclui lives, então cada sincronização também lê a playlist de lives do canal (prefixo `UULV`, também fora da documentação oficial). O `videos.list` passa a pedir `liveStreamingDetails` além dos outros campos.
  - Mostrar só vídeos com `snippet.liveBroadcastContent = 'none'` **e** `liveStreamingDetails.actualEndTime` preenchido, ou seja, lives encerradas.
  - Lives agendadas (`upcoming`) ou acontecendo agora (`live`) são salvas com `live_state = 'pending'`, ficam escondidas e são reavaliadas a cada sincronização até terminarem. Isso evita que a sincronização incremental pule essas lives depois que elas acabam.
  - Gravação de live também entra no feed como novidade, com a mesma regra dos outros vídeos.
  - Se a playlist `UULV` não existir ou der erro, o canal segue sem lives naquela sincronização; não é um erro.
  - No caminho de reserva (playlist `UU...`), a mesma regra de lives é aplicada a todos os vídeos.
  - A verificação de Shorts abaixo vale para qualquer vídeo, inclusive gravações de lives.
- **Verificação extra contra Shorts (obrigatória):** todo vídeo novo com duração ≤ 180 s passa por uma checagem em `https://www.youtube.com/shorts/{id}` sem seguir redirecionamento. Status 200 significa Short e o vídeo é descartado. Redirecionamento (303) significa vídeo normal.
  - Se a playlist `UULF` de um canal não existir ou der erro, a sincronização daquele canal usa a playlist de uploads normal (`UU...`) e aplica a verificação a todos os vídeos com até 180 s.
  - Vídeos marcados como Short são guardados com `is_short = true` e **nunca** aparecem em nenhuma consulta da interface.
- **Detalhes:** `videos.list` (em lotes de 50) busca duração, data, thumbnail e `status.embeddable`.
- **Sincronização incremental:** a paginação para quando encontra um vídeo que já está no banco.
- **Primeira importação de um canal:** importar os vídeos dos **últimos 30 dias** para o feed, mais o histórico completo de vídeos longos para a página do canal e para a busca. Vídeos com mais de 30 dias já entram como "fora do feed", não como "novos". *(Minha decisão: evita um feed enorme logo no primeiro dia, o que contrariaria o "feed com fim".)*
- **Quem fica no feed (minha decisão):** um vídeo entra no feed (`in_feed = true`) quando é importado como novo e **fica até ser assistido ou dispensado**. Não existe janela móvel: o vídeo não some sozinho no dia 31. Os 30 dias valem só para a primeira importação de cada canal.
- **Dispensar (minha decisão):** cada card do feed tem uma ação "Dispensar". Ela tira o vídeo do feed sem marcar como assistido, e é o que permite chegar ao "Você está em dia" sem poluir o histórico.
- **Na dúvida, esconde (decorre do anti-objetivo de Shorts):** vídeos com até 180 s ficam com `shorts_check = 'pending'` e **não aparecem** até a checagem confirmar que não são Short. Se a checagem der erro, timeout, 429, página de consentimento ou qualquer status diferente de 200 ou 303, o vídeo continua pendente e é testado de novo na próxima sincronização. Depois de 5 falhas seguidas, ele fica escondido de vez (tratado como Short). Se a checagem se mostrar inviável em produção, a regra de reserva é esconder todo vídeo com até 180 s. Aceita-se perder alguns vídeos curtos legítimos em troca de nunca mostrar um Short.
- **Agendamento:** Vercel Cron 1x/dia chama `/api/cron/sync`. O botão "Atualizar agora" chama a mesma lógica. Se a sincronização passar do tempo limite da função, ela processa os canais em lotes e continua na próxima chamada.
- **Custo estimado:** com 50 canais, cerca de 3 a 6 unidades por canal por sincronização (vídeos longos + lives), ou seja, menos de 300 unidades por sincronização. Muito abaixo do limite.

### 6.4 Player

- YouTube IFrame Player API, com `rel=0` (sugestões no fim do vídeo ficam restritas ao mesmo canal), `modestbranding` e sem autoplay do próximo vídeo.
- Salvar a posição a cada ~10 s e ao pausar ou sair. Retomar a partir da posição salva.
- **Assistido automaticamente** ao chegar a 90% da duração. Também existe um botão para marcar e desmarcar manualmente.
- **Tela final própria (minha decisão, por causa dos anti-objetivos):** quando o vídeo termina (evento `ENDED`), o iframe é destruído e trocado por uma tela final do ZamparTube com "Marcado como assistido", "Voltar ao feed" e, se veio de uma playlist, "Próximo da playlist". Isso evita a grade de sugestões do YouTube no fim do vídeo. Durante a reprodução nada é sobreposto ao player, como mandam as regras do YouTube. Usar `iv_load_policy=3` para reduzir as anotações. Limitação aceita: cards e telas finais que o criador coloca *dentro* do vídeo não podem ser removidos.
- Vídeo com incorporação bloqueada (`embeddable = false`): mostrar thumbnail e botão "Abrir no YouTube" em nova aba.

### 6.5 Telas

1. **Login:** campo de senha.
2. **Feed (início):** vídeos com `in_feed = true` ainda não assistidos nem dispensados (ver 6.3), mais recentes primeiro, com filtro de categoria no topo. No fim da lista, a mensagem "Você está em dia". Paginação simples com "Carregar mais" só se houver muitos itens; nada de rolagem infinita automática.
3. **Vídeo:** player, título, canal, data, descrição recolhível, botões "Assistido", "Assistir depois" e "Adicionar à playlist". Sem lista de vídeos relacionados.
4. **Canais:** lista de canais com categoria, campo para adicionar canal, remover canal e trocar a categoria. Gerenciar categorias (criar, renomear, apagar).
5. **Página do canal:** todos os vídeos longos do canal (paginados), com indicação de assistido e progresso.
6. **Playlists:** lista de playlists (com "Assistir depois" fixa no topo) e a página de cada playlist com reordenação. Na página da playlist, um botão "Tocar a seguir" leva ao próximo vídeo; não há autoplay.
7. **Busca:** campo de busca com resultados apenas do banco local.

Navegação: barra lateral no desktop e barra inferior no celular.

### 6.6 Visual

Revisado em 2026-11-03 (rebrand "soft", escolhido pelo usuário no comparador visual: paleta A + Geist).

- Tema escuro suave, com baixo contraste. Quem chama atenção são as miniaturas dos vídeos, não a interface.
- Fundo grafite , superfícies  / , borda .
- Texto creme  e texto secundário .
- Destaque azul-acinzentado  (passar o mouse: ), com texto escuro  sobre ele. Erros em rosado suave .
- Destaque usado com parcimônia: menu ativo, filtro selecionado e confirmações têm só um fundo levemente azulado. Cor cheia fica para uma ou duas ações por tela, em botões de pílula.
- Cantos de 14 px nos cards e no player.
- Fonte Geist.
- Logo: quadradinho azul-acinzentado com o símbolo de play em grafite. Nada de vermelho e nada da identidade do YouTube.

### 6.7 Modelo de dados (sugestão)

- `categories` (id, name, position)
- `channels` (id = ID do YouTube `UC...`, title, handle, avatar_url, uploads_playlist_id, category_id, added_at, last_synced_at)
- `videos` (id = ID do YouTube, channel_id, title, description, published_at, duration_seconds, thumbnail_url, embeddable, is_short, shorts_check ['not_needed' | 'pending' | 'ok' | 'short'], shorts_check_failures, is_live_recording, live_state ['none' | 'pending' | 'ended'], in_feed, dismissed_at)
- `watch_state` (video_id, position_seconds, watched, updated_at)
- `playlists` (id, name, is_watch_later, created_at)
- `playlist_items` (playlist_id, video_id, position, added_at)
- Índice de busca: `tsvector` em português sobre título e descrição.

Ao remover um canal, seus vídeos saem do feed e da busca. Os vídeos que estão em playlists continuam lá.

### 6.8 Variáveis de ambiente

`YOUTUBE_API_KEY`, `DATABASE_URL` (Neon), `APP_PASSWORD`, `SESSION_SECRET`, `CRON_SECRET`. Um `.env.example` documenta cada uma. O `.env.local` fica no `.gitignore`.

## 7. Tarefas do usuário (fora do código)

- Restringir a chave da API à YouTube Data API v3 no Google Cloud Console. Ela já foi colada no chat, então vale considerar gerar uma nova.
- Criar o banco no Neon e copiar a connection string.
- Criar o projeto na Vercel e cadastrar as variáveis de ambiente.
- Informar a lista inicial de canais (ou cadastrá-los pela tela de Canais).

## 8. Deixado para quem construir

- Estrutura de pastas, componentes e detalhes de layout dentro das diretrizes acima.
- Ícones, tipografia e microinterações.
- Estratégia de testes. Mínimo esperado: testes da lógica de sincronização e do filtro de Shorts, com respostas da API simuladas.
