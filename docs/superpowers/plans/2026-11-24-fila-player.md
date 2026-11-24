# Fila de vídeos e controles do player — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fila de vídeos no servidor, tocada num player persistente (tela cheia sobrevive à troca), com ⏮/⏭ no centro, autoplay opcional, legendas desligadas por padrão com botão CC, sem botões ±10 s, Shift+N/P e Media Session.

**Architecture:** Tabela `queue_items` + queries puras testadas com PGlite. O `Player` sobe para `app/(app)/watch/layout.tsx` (layouts não remontam na navegação) e troca de vídeo via `loadVideoById`; a página `watch/[id]` publica o vídeo atual num contexto e renderiza detalhes/painel no servidor. Navegação entre vídeos é `router.push` normal.

**Tech Stack:** Next 16.4.6 App Router, React 19.3, Drizzle + Postgres (PGlite nos testes), Tailwind 4, Radix, lucide-react, vitest.

**Spec:** `docs/superpowers/specs/2026-11-24-fila-player-design.md`

## Global Constraints

- Ler a doc local do Next (`node_modules/next/dist/docs/`) antes de criar arquivos de rota (AGENTS.md).
- Sem dependências novas (reordenar por Pointer Events + botões ↑/↓).
- Toda action: `await requireSession()` e valida ids (`/^[\w-]{6,20}$/` para vídeo, inteiro > 0 para playlist); termina com `revalidatePath("/", "layout")`.
- Textos de interface em português; preferências por aparelho em localStorage com try/catch (`readPref`/`writePref` já existentes): `zt.autoplay` (padrão 1), `zt.captions` (padrão 0).
- Pilha de tocados limitada a **50**; contagem do autoplay **5 s**.
- Não fazer commits a menos que o usuário peça (a branch tem trabalho anterior não commitado).

## Review Focus

1. Vídeo da fila que ficou invisível (removido/dispensado/ao vivo): `neighbors` deve pulá-lo (usar `visibleVideoCondition()`), nunca apontar para 404. → teste na Task 1.
2. ⏮ ⏭ ⏮ em sequência deve voltar exatamente ao mesmo estado da fila. → teste na Task 1.
3. Trocar de vídeo em tela cheia nativa e de página (iPhone) não pode sair da tela cheia nem deixar o tempo/buffer/fim do vídeo anterior na tela. → verificação manual na Task 9.
4. Vídeo não incorporável/erro no meio da fila: tela de fallback ainda oferece ⏮/⏭, e o autoplay não trava. → Task 6 + verificação Task 9.
5. Duas abas / dois aparelhos: adicionar um vídeo já presente move em vez de duplicar (PK) e `enqueue` é idempotente. → teste na Task 1.

---

### Task 1: Tabela e queries da fila

**Files:**
- Modify: `src/lib/db/schema.ts` (nova tabela `queueItems`)
- Create: `drizzle/0006_queue.sql` + snapshot/journal (via `npx drizzle-kit generate --name queue`; se o config recusar o `DATABASE_URL` local, rodar com `DATABASE_URL=postgresql://x@localhost/x` só para gerar — generate não conecta)
- Create: `src/lib/queries/queue.ts`
- Test: `tests/lib/queries/queue.test.ts`

**Interfaces:**
- Produces:
  - `queueItems` (`videoId` text PK → videos cascade, `position` int not null, `playedAt` timestamptz null, `addedAt` timestamptz default now) + índice em `played_at`.
  - `enqueue(db, videoIds: string[], mode: "end" | "next"): Promise<void>`
  - `removeFromQueue(db, videoId: string): Promise<void>`
  - `moveInQueue(db, videoId: string, toIndex: number): Promise<void>` (índice entre os próximos visíveis)
  - `clearQueue(db): Promise<void>` (apaga tudo)
  - `replaceQueue(db, videoIds: string[]): Promise<void>` (clear + enqueue end)
  - `markPlaying(db, videoId: string): Promise<void>`
  - `queueNeighbors(db, currentId: string): Promise<{ prev: string | null; next: string | null }>`
  - `goBackInQueue(db, currentId: string): Promise<string | null>` (retorna o id para onde ir)
  - `listQueue(db): Promise<VideoCardData[]>` (próximos visíveis, em ordem)
  - `queueCount(db): Promise<number>`

- [ ] **Step 1: Escrever os testes** (setup igual a `playlists.test.ts`: `createTestDb`, `insertChannel(CH_A)`, vídeos `a`..`e`; `ids = (await listQueue(db)).map(v => v.id)`):
  - `enqueue end keeps order`: enqueue([a,b]) → enqueue([c]) → ids = [a,b,c]
  - `enqueue next goes to the front preserving batch order`: [a,b] + next([c,d]) → [c,d,a,b]
  - `enqueue an existing id moves it, never duplicates`: [a,b,c] + end([a]) → [b,c,a]; + next([c]) → [c,b,a]
  - `enqueue a played id brings it back`: [a,b], markPlaying(a), end([a]) → [b,a]
  - `markPlaying removes from upcoming`: [a,b,c], markPlaying(b) → [a,c]; `queueNeighbors(db,"b")` = {prev: null, next: "a"}
  - `markPlaying of a video not in the queue is a no-op`: [a], markPlaying(e) → [a]
  - `neighbors skip invisible videos`: [a,b], `update videos set in_feed=false, dismissed...` (usar o mesmo critério que `visibleVideoCondition` exclui, p.ex. `liveState: "live"`) em a → next = "b"
  - `prev is the top of the played stack excluding current`: [a,b,c]; markPlaying(a); markPlaying(b) → neighbors(b) = {prev:"a", next:"c"}
  - `goBack puts current back in front and is reversible`: [a,b,c]; markPlaying(a); markPlaying(b); goBack(b) → retorna "a", ids = [b,c]; markPlaying(a) (no-op), neighbors(a) = {prev:null,next:"b"}; markPlaying(b) → ids=[c], neighbors(b) = {prev:"a", next:"c"}
  - `played stack is capped at 50`: enfileirar 52 vídeos inseridos no teste, marcar todos → `select count(*) where played_at is not null` = 50
  - `clearQueue empties upcoming and played`; `replaceQueue` = só os novos; `moveInQueue(c, 0)` em [a,b,c] → [c,a,b]; `removeFromQueue`; `queueCount` conta só próximos visíveis.

- [ ] **Step 2:** `npx vitest run tests/lib/queries/queue.test.ts` → FAIL (módulo inexistente).
- [ ] **Step 3:** Adicionar tabela, gerar migração, implementar `queue.ts`. `position`: "end" = `coalesce(max,0)+1+i`; "next" = `coalesce(min,1)-n+i`. `markPlaying` também apaga os tocados além dos 50 mais recentes. `goBackInQueue`: prev = topo dos tocados ≠ current (visível); se current está nos tocados → `played_at=null, position=min-1`; prev recebe `played_at=now()`. Upsert com `onConflictDoUpdate` (posição nova, `playedAt: null`).
- [ ] **Step 4:** Rodar o teste → PASS; `npx vitest run` inteiro → PASS.

### Task 2: Anterior na playlist

**Files:** Modify `src/lib/queries/playlists.ts`; Test `tests/lib/queries/playlists.test.ts`

**Interfaces:** Produces `getPrevInPlaylist(db, playlistId: number, currentVideoId: string): Promise<string | null>` (espelho de `getNextInPlaylist` com `"up"`).

- [ ] **Step 1:** Teste `getPrevInPlaylist returns the previous visible item`: playlist [a,b,c] → prev(c)="b", prev(a)=null; com b invisível → prev(c)="a".
- [ ] **Step 2:** FAIL → **Step 3:** implementar → **Step 4:** PASS.

### Task 3: Atalhos Shift+N / Shift+P

**Files:** Modify `src/lib/player/controls.ts`; Test `tests/lib/player/controls.test.ts`

**Interfaces:** `Shortcut` ganha `{ type: "next" } | { type: "prev" }`; `shortcutFor(key: string, shift = false)`.

- [ ] **Step 1:** Testes: `shortcutFor("N", true)` → `{type:"next"}`; `shortcutFor("P", true)` → `{type:"prev"}`; `shortcutFor("n")` → null; `shortcutFor("k")` continua toggle.
- [ ] **Step 2:** FAIL → **Step 3:** implementar (checar `shift` antes do switch atual) → **Step 4:** PASS.

### Task 4: Actions da fila e resolução de anterior/próximo

**Files:**
- Create: `src/app/(app)/queue/actions.ts`
- Create: `src/lib/queries/watch-nav.ts`
- Test: `tests/lib/queries/watch-nav.test.ts`

**Interfaces:**
- Consumes: Task 1 e 2.
- Produces:
  - Actions: `enqueueAction(videoIds: string[], mode: "end" | "next")`, `removeFromQueueAction(id)`, `moveInQueueAction(id, toIndex)`, `clearQueueAction()`, `playPlaylistAction(playlistId): Promise<string | null>` (replaceQueue com a playlist, retorna o primeiro id), `enqueuePlaylistAction(playlistId)`, `markPlayingAction(id)`, `goBackAction(id): Promise<string | null>`.
  - `type NavTarget = { id: string; title: string; thumbnailUrl: string; href: string }`
  - `resolveWatchNav(db, currentId: string, listId: number | null): Promise<{ prev: NavTarget | null; next: NavTarget | null; source: "queue" | "playlist" }>` — com `listId`: vizinhos da playlist e `href` com `?list=`; sem: `queueNeighbors`, `href` `/watch/<id>`.

- [ ] **Step 1:** Testes de `resolveWatchNav`: com listId → source "playlist", hrefs `/watch/b?list=<id>`; sem listId e fila [b] → next.href `/watch/b`, title "Vídeo b"; fila vazia → ambos null.
- [ ] **Step 2:** FAIL → **Step 3:** implementar (actions seguem o padrão de `playlists/actions.ts`) → **Step 4:** PASS.

### Task 5: Player persistente

**Files:**
- Create: `src/app/(app)/watch/layout.tsx` (servidor: `<div className="mx-auto max-w-5xl"><WatchShell>{children}</WatchShell></div>`)
- Create: `src/components/player/NowPlaying.tsx` (`WatchShell` provider + `NowPlaying` publisher, cliente)
- Modify: `src/components/Player.tsx`, `src/components/player/youtube-api.ts`, `src/app/(app)/watch/[id]/page.tsx`

**Interfaces:**
- Produces:
  - `interface CurrentVideo { id; title; channelTitle; durationSeconds; startAt; thumbnailUrl; embeddable: boolean; prev: NavTarget | null; next: NavTarget | null; source: "queue" | "playlist" }`
  - `<NowPlaying video={CurrentVideo} />` (sem UI; publica em `useEffect`)
  - `WatchShell` renderiza `<Player video={current} />` (ou fallback de não-incorporável) acima de `children`; antes da primeira publicação, um placeholder `aspect-video` preto.
  - `YTPlayer` ganha `loadVideoById(opts: { videoId: string; startSeconds?: number }): void`, `loadModule?(name: string): void`, `unloadModule?(name: string): void`.
  - `Player` props: `{ video: CurrentVideo; onNavigate: (dir: "prev" | "next") => void }`.
- `onNavigate` (no shell): `next` → `router.push(next.href, { scroll: false })`; `prev` com source "queue" → `await goBackAction(id)` e push `prev.href`; source "playlist" → push.
- Quando um vídeo começa a tocar pela 1ª vez e `source === "queue"`: `markPlayingAction(id)`.

- [ ] **Step 1:** Ler `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md` (layouts aninhados).
- [ ] **Step 2:** Refatorar `Player`: criar `YT.Player` uma vez (efeito sem `videoId` nas deps); efeito separado em `video.id` que, se o player está pronto e o id mudou, salva o progresso do anterior, reseta `current/buffered/duration/ended/failed/tapThrough/status="loading"`, e chama `loadVideoById({ videoId, startSeconds: startAt })`. `ENDED` não destrói mais o player (para trocar depois); só pausa a UI e mostra o `EndScreen` como overlay dentro do container. `onError` idem: overlay de falha sem destruir. Replay = `seekTo(0)` + `playVideo()`.
- [ ] **Step 3:** Página: remover `<Player>`/fallback; chamar `resolveWatchNav`; renderizar `<NowPlaying video={...} />`; remover o link "Próximo da playlist".
- [ ] **Step 4:** `npx tsc --noEmit` e `npx vitest run` → sem erros.

### Task 6: Controles, legendas, autoplay e tela final

**Files:** Modify `src/components/Player.tsx`, `src/components/player/PlayerControls.tsx`, `src/components/EndScreen.tsx`

- [ ] **Step 1: Centro:** trio ⏮ ▶/⏸ ⏭ (`SkipBack`, `Play`/`Pause`, `SkipForward`) centralizado, visível quando `showChrome` (com loader no lugar do ▶ em `loading`); ⏮/⏭ `disabled` + `aria-label` "Vídeo anterior (Shift+P)" / "Próximo vídeo (Shift+N)"; poster continua só pausado/não iniciado.
- [ ] **Step 2: Barra:** remover botões ±10 s (manter `onSeekBy` para teclado/toque duplo); adicionar botão CC (`Captions`, `aria-pressed`) e switch "Reprodução automática" (só se `video.next`).
- [ ] **Step 3: Legendas:** `playerVars.cc_load_policy = 0`; em `onReady` e a cada `PLAYING`, se `zt.captions` = 0 → `unloadModule?.("captions")` e `unloadModule?.("cc")`; CC liga → `loadModule?.("captions")` e grava 1.
- [ ] **Step 4: EndScreen:** props `{ next: NavTarget | null; nextLabel: string; autoplay: boolean; onNext(); onReplay() }`. Com `autoplay && next`: contagem 5→0 (mostra miniatura e título do próximo, "Cancelar" e "Tocar agora"); ao zerar `onNext()`. Sem: botão `nextLabel` ("Próximo da fila"/"Próximo da playlist"). Renderizado **dentro** do container (sem sair da tela cheia). Tela de falha também mostra ⏮/⏭.
- [ ] **Step 5:** `npx tsc --noEmit`, `npx eslint src` → limpo.

### Task 7: Teclado e Media Session

**Files:** Modify `src/components/Player.tsx`

- [ ] **Step 1:** No handler de teclado passar `e.shiftKey` para `shortcutFor`; `next`/`prev` chamam `onNavigate` só se houver destino.
- [ ] **Step 2:** Efeito em `video`: se `"mediaSession" in navigator`, `metadata = new MediaMetadata({ title, artist: channelTitle, artwork: [{ src: thumbnailUrl }] })`; handlers `play`/`pause` → player; `nexttrack`/`previoustrack` → `onNavigate` ou `null` sem destino; limpar no unmount.

### Task 8: Interface da fila

**Files:**
- Modify: `src/components/CardActions.tsx`, `src/app/(app)/watch/[id]/page.tsx`, `src/app/(app)/playlists/[id]/page.tsx` (+ componente cliente de cabeçalho), `src/app/(app)/playlists/page.tsx`, `src/components/Nav.tsx`, `src/app/(app)/layout.tsx` (contador)
- Create: `src/components/QueuePanel.tsx`, `src/components/QueueButton.tsx`, `src/app/(app)/queue/page.tsx`

- [ ] **Step 1: Cards:** "Adicionar à fila" (`ListPlus`) e "Tocar a seguir" (`ListStart`) — ícones no hover, itens no menu ⋮.
- [ ] **Step 2: Tela do vídeo:** `QueueButton` ("Adicionar à fila"/"Na fila", otimista) junto dos outros botões; `QueuePanel` com `listQueue` (source fila) ou `listPlaylistVideos` com item atual destacado (source playlist, só leitura). Layout: painel abaixo dos botões, antes da descrição, em todas as larguras (o player fica no layout, então uma coluna lateral exigiria um slot extra; decisão: simplicidade — desvia do "coluna à direita em lg" da spec, registrado aqui).
- [ ] **Step 3: QueuePanel:** item com miniatura/título/canal → link; remover (X); ↑/↓ (`moveInQueueAction`); arrastar com Pointer Events reordenando localmente e chamando `moveInQueueAction` no soltar; "Limpar fila" com o confirm Radix existente.
- [ ] **Step 4: `/queue`:** título "Fila", `QueuePanel`, botão "Reproduzir fila" → `/watch/<primeiro>`; vazio: texto explicando como adicionar.
- [ ] **Step 5: Playlists:** cabeçalho da playlist: "Tocar tudo" (`playPlaylistAction` → push; confirm se `queueCount > 0`) e "Adicionar à fila"; o atual "Tocar a seguir" do cabeçalho vira "Continuar" para não colidir com o termo da fila. `/playlists`: cartão "Fila (n)" no topo → `/queue`. SideNav: item "Fila" (`ListOrdered`) com contador (passado do layout).
- [ ] **Step 6:** `npx tsc --noEmit`, `npx eslint src`, `npx vitest run` → limpo.

### Task 9: Verificação no navegador

- [ ] `preview_start` do dev server; logar com a senha de `.env.local` (teste local).
- [ ] Adicionar 3 vídeos à fila pelos cards; abrir o 1º: sai do painel; ⏭ troca sem recarregar o iframe (mesmo elemento `iframe` no DOM antes/depois); em tela cheia continua em tela cheia.
- [ ] ⏮ volta e o vídeo atual reaparece no topo do painel; ⏮/⏭ desabilitados nas pontas.
- [ ] Fim do vídeo (seek para o fim): autoplay conta 5 s e avança; desligado mostra só o botão.
- [ ] Legendas não aparecem num vídeo com legenda automática; CC liga/desliga.
- [ ] Sem botões ±10 s; j/l ainda funcionam; Shift+N/P navegam; sem erros no console.
- [ ] `?list=` a partir de uma playlist: ⏮/⏭ seguem a playlist.
