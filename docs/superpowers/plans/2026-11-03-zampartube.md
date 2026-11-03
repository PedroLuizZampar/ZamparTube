# ZamparTube Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um "YouTube pessoal" para um único usuário: mostra só vídeos (sem Shorts) de canais escolhidos, com feed que termina, playlists, busca local e progresso salvo.

**Architecture:** App Next.js (App Router) na Vercel. Uma camada de sincronização no servidor lê a YouTube Data API v3 (playlists `UULF`/`UULV`, com reserva `UU`), classifica cada vídeo (Short / live / visível) e grava no Neon via Drizzle. Todas as telas leem só do banco, por consultas que passam por um único filtro de visibilidade. Mutações são Server Actions; o acesso é protegido por senha única + cookie assinado.

**Tech Stack:** Next.js (versão estável atual, App Router) · TypeScript · Tailwind CSS · Drizzle ORM + drizzle-kit · `@neondatabase/serverless` · `jose` (cookie de sessão) · `zod` (env) · Vitest · `@electric-sql/pglite` (Postgres em memória nos testes).

**Spec:** `docs/superpowers/specs/2026-11-03-zampartube-design.md`

## Global Constraints

- Idioma da interface: português do Brasil. Código, nomes de arquivos e identificadores em inglês.
- **Nenhum Short em lugar nenhum** (feed, busca, página do canal, playlists, tela de vídeo). Toda consulta que lista vídeos passa por `visibleVideoCondition()` (Task 6). Acesso direto a `/watch/[id]` de um vídeo não visível responde 404.
- `SHORTS_MAX_SECONDS = 180`, `MAX_PROBE_FAILURES = 5`, `FEED_WINDOW_DAYS = 30`, `WATCHED_RATIO = 0.9`, `PROGRESS_SAVE_INTERVAL_MS = 10_000`.
- Nunca chamar `search.list`. Só `channels.list`, `playlistItems.list` e `videos.list`.
- `YOUTUBE_API_KEY` só no servidor: nada em `NEXT_PUBLIC_*`, nenhum módulo de `src/lib/youtube` importado por componente cliente (usar `import "server-only"`).
- Player: só o iframe oficial; `rel=0`, `iv_load_policy=3`, `modestbranding=1`, `playsinline=1`; sem autoplay de próximo vídeo; nada sobreposto ao player durante a reprodução.
- Sem rolagem infinita automática. Paginação só com botão "Carregar mais".
- Identidade: nome "ZamparTube", ícone azul próprio. Nenhum vermelho de marca, nenhum logo do YouTube.
- Cores (tokens Tailwind): `bg #0B0F17`, `surface #131A26`, `surface-2 #1B2433`, `border #243047`, `accent #3B82F6`, `accent-hover #2563EB`, `text #E6EAF2`, `muted #8B95A7`.
- Banco: não usar transações interativas. Cada mutação deve ser uma instrução SQL única ou tolerar ser reexecutada.
- Variáveis de ambiente: `YOUTUBE_API_KEY`, `DATABASE_URL`, `APP_PASSWORD`, `SESSION_SECRET`, `CRON_SECRET`.

## Review Focus

1. **Formatos de entrada de canal** que o usuário vai colar: `https://www.youtube.com/@handle/videos`, `youtube.com/channel/UC…?si=…`, `m.youtube.com/@handle`, `@handle`, `UC…`, e o formato antigo `youtube.com/c/Nome` ou `/user/Nome`, que deve dar uma mensagem clara em vez de falhar em silêncio. Testes na Task 3.
2. **Primeira importação de um canal enorme** (milhares de vídeos) sem estourar o tempo da função: o histórico é importado aos poucos (`backfill_page_token`) ao longo de várias sincronizações. Teste na Task 5.
3. **Cota esgotada** (`403 quotaExceeded`) no meio da sincronização: a sincronização para limpa, informa "Cota diária da API esgotada" e não grava estado parcial errado. Testes nas Tasks 4 e 5.
4. **Vídeo apagado ou privado depois de salvo** (some do `videos.list` na reavaliação): ele sai do banco e das playlists, e as playlists continuam funcionando. Teste na Task 5.
5. **Vídeo com incorporação bloqueada** (`embeddable = false`) e **vídeo não visível acessado por link direto**: o primeiro mostra thumbnail + "Abrir no YouTube"; o segundo dá 404. Testes nas Tasks 6 e 10.

---

## File Structure

```
.env.example                      variáveis documentadas
vercel.json                       cron diário
drizzle.config.ts                 drizzle-kit
drizzle/                          migrations geradas
src/
  middleware.ts                   (ou proxy.ts no Next 16+) bloqueio por sessão
  lib/
    env.ts                        leitura validada de env
    constants.ts                  constantes globais
    auth/session.ts               token de sessão + senha
    db/schema.ts                  tabelas Drizzle
    db/client.ts                  conexão Neon (tipo Db)
    youtube/parse.ts              entrada de canal, duração ISO, IDs de playlist
    youtube/client.ts             wrappers de fetch da Data API
    youtube/shorts-probe.ts       checagem /shorts/{id}
    sync/classify.ts              regras puras de Short/live
    sync/sync-channel.ts          sincroniza um canal
    sync/run-sync.ts              sincroniza todos dentro de um orçamento de tempo
    queries/visibility.ts         filtro único de visibilidade
    queries/videos.ts             feed, canal, busca, vídeo único
    queries/watch.ts              progresso, assistido, dispensar
    queries/channels.ts           canais e categorias
    queries/playlists.ts          playlists
    player/progress.ts            regras puras do player
  app/
    layout.tsx, globals.css, manifest.ts
    login/page.tsx, login/actions.ts
    api/cron/sync/route.ts
    (app)/layout.tsx              shell com navegação
    (app)/page.tsx                feed
    (app)/actions.ts              ações de feed/vídeo/sync
    (app)/watch/[id]/page.tsx
    (app)/channels/page.tsx, (app)/channels/actions.ts
    (app)/channel/[id]/page.tsx
    (app)/playlists/page.tsx, (app)/playlists/[id]/page.tsx, (app)/playlists/actions.ts
    (app)/search/page.tsx
  components/                     Nav, VideoCard, VideoGrid, CategoryFilter, Player, EndScreen,
                                  AddToPlaylistMenu, SyncButton, LoadMore
public/icon.svg, icon-192.png, icon-512.png
tests/                            espelha src/lib; tests/helpers/db.ts
```

---

### Task 1: Projeto base, env e tema

**Files:**
- Create: projeto via `create-next-app`, `src/lib/env.ts`, `src/lib/constants.ts`, `.env.example`, `vitest.config.ts`, `src/app/globals.css` (tokens), `src/app/layout.tsx`
- Test: `tests/lib/env.test.ts`

**Interfaces:**
- Produces: `getEnv(): Env` com `{ YOUTUBE_API_KEY, DATABASE_URL, APP_PASSWORD, SESSION_SECRET, CRON_SECRET }` (strings não vazias); constantes de Global Constraints exportadas de `src/lib/constants.ts`.

- [ ] **Step 1: Criar o projeto** em `C:\Dev\JS\ZamparTube`, com a pasta `docs/` preservada:

```bash
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
git init
npm i drizzle-orm @neondatabase/serverless jose zod server-only
npm i -D drizzle-kit vitest @electric-sql/pglite vite-tsconfig-paths
```

Se o `create-next-app` recusar por a pasta não estar vazia, mova `docs/` temporariamente e devolva depois. Adicione `"test": "vitest run"` ao `package.json`. O `vitest.config.ts` usa `vite-tsconfig-paths` e `environment: "node"`. Confirme que `.env*.local` está no `.gitignore`.

- [ ] **Step 2: Teste que falha** (`tests/lib/env.test.ts`):

```ts
it("returns all vars when present", () => { /* stub 5 vars */ expect(getEnv().CRON_SECRET).toBe("c"); });
it("throws listing every missing var", () => {
  vi.stubEnv("YOUTUBE_API_KEY", ""); vi.stubEnv("APP_PASSWORD", "");
  expect(() => getEnv()).toThrow(/YOUTUBE_API_KEY.*APP_PASSWORD|APP_PASSWORD.*YOUTUBE_API_KEY/);
});
```

- [ ] **Step 3:** `npm test -- tests/lib/env.test.ts` → FAIL (módulo não existe).
- [ ] **Step 4: Implementar `getEnv()`** com zod (`z.string().min(1)` para cada uma). A mensagem de erro lista todos os nomes faltantes. `.env.example` com as 5 variáveis e um comentário de uma linha em português para cada.
- [ ] **Step 5: Tema.** Em `globals.css`, definir os tokens de cor de Global Constraints como tema Tailwind (`--color-bg`, `--color-surface`, …). `body` com `bg-bg text-text`. `layout.tsx` com `lang="pt-BR"`, `title: "ZamparTube"`, `themeColor: "#0B0F17"`. Remover o conteúdo de exemplo do template.
- [ ] **Step 6:** `npm test` → PASS; `npm run build` → sucesso.
- [ ] **Step 7: Commit** `chore: scaffold Next.js app with env validation and dark theme tokens`

---

### Task 2: Schema do banco e helper de teste

**Files:**
- Create: `src/lib/db/schema.ts`, `src/lib/db/client.ts`, `drizzle.config.ts`, `tests/helpers/db.ts`, migration em `drizzle/`
- Test: `tests/lib/db/schema.test.ts`

**Interfaces:**
- Produces:
  - `type Db = PgDatabase<PgQueryResultHKT, typeof schema>` (compatível com Neon e PGlite); `getDb(): Db` (singleton com `drizzle-orm/neon-serverless` + `Pool`).
  - `createTestDb(): Promise<Db>` (PGlite em memória + `migrate` da pasta `drizzle`).
  - Tabelas (nomes TS em camelCase, colunas em snake_case):
    - `categories`: `id serial pk`, `name text not null unique`, `position int not null default 0`.
    - `channels`: `id text pk` (UC…), `title`, `handle text null`, `avatarUrl`, `uploadsPlaylistId`, `categoryId int null fk → categories on delete set null`, `addedAt timestamptz default now`, `lastSyncedAt timestamptz null`, `removedAt timestamptz null`, `backfillPageToken text null`, `longPlaylistMissing boolean default false`.
    - `videos`: `id text pk`, `channelId fk → channels`, `title`, `description`, `publishedAt timestamptz`, `durationSeconds int`, `thumbnailUrl`, `embeddable boolean`, `isShort boolean default false`, `shortsCheck` enum `not_needed|pending|ok|short`, `shortsCheckFailures int default 0`, `isLiveRecording boolean default false`, `liveState` enum `none|pending|ended`, `inFeed boolean`, `dismissedAt timestamptz null`, `searchVector tsvector` gerado: `to_tsvector('portuguese', coalesce(title,'') || ' ' || coalesce(description,''))` STORED, índice GIN. Índice em `(channel_id, published_at desc)`.
    - `watchState`: `videoId text pk fk → videos on delete cascade`, `positionSeconds int default 0`, `watched boolean default false`, `updatedAt timestamptz default now`.
    - `playlists`: `id serial pk`, `name text not null`, `isWatchLater boolean default false`, `createdAt`. Índice único parcial: só uma linha com `is_watch_later = true`.
    - `playlistItems`: `playlistId fk on delete cascade`, `videoId fk → videos on delete cascade`, `position int`, `addedAt`; pk `(playlist_id, video_id)`.
  - A migration insere a playlist "Assistir depois" com `is_watch_later = true`.

> Nota: o design guarda "remover canal" como soft delete (`removedAt`), para que vídeos em playlists continuem existindo (spec 6.7). `longPlaylistMissing` marca canais que usam a reserva `UU`.

- [ ] **Step 1: Teste que falha:**

```ts
it("migrates and seeds exactly one watch-later playlist", async () => {
  const db = await createTestDb();
  const rows = await db.select().from(playlists);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ name: "Assistir depois", isWatchLater: true });
});
it("search_vector matches portuguese stems", async () => {
  /* insert channel + video titled "Aprendendo programação funcional" */
  const r = await db.execute(sql`select id from videos where search_vector @@ plainto_tsquery('portuguese','programacao')`);
  expect(r.rows).toHaveLength(1);
});
```

(Se o dicionário `portuguese` não remover acentos, ajuste o teste para `'programação'`. A busca sem acento fica como melhoria futura; não instale extensões.)

- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3: Implementar schema, client e config.** Depois `npx drizzle-kit generate`. Acrescente o `INSERT` da playlist "Assistir depois" à migration gerada, ou crie uma migration SQL customizada com `drizzle-kit generate --custom`.
- [ ] **Step 4:** rodar → PASS.
- [ ] **Step 5: Commit** `feat: database schema with search vector and watch-later seed`

---

### Task 3: Helpers de parsing do YouTube

**Files:**
- Create: `src/lib/youtube/parse.ts`
- Test: `tests/lib/youtube/parse.test.ts`

**Interfaces:**
- Produces:
  - `type ChannelRef = { kind: "id"; id: string } | { kind: "handle"; handle: string }`
  - `parseChannelInput(input: string): { ok: true; ref: ChannelRef } | { ok: false; error: string }`
  - `parseIsoDuration(iso: string): number` (segundos; `P0D` → 0)
  - `longVideosPlaylistId(channelId)`, `livesPlaylistId(channelId)`, `uploadsPlaylistId(channelId)`: trocam o prefixo `UC` por `UULF` / `UULV` / `UU`.

- [ ] **Step 1: Testes que falham:**

```ts
it.each([
  ["@canal_x", { kind: "handle", handle: "canal_x" }],
  ["https://www.youtube.com/@canal_x/videos", { kind: "handle", handle: "canal_x" }],
  ["m.youtube.com/@canal_x?si=abc", { kind: "handle", handle: "canal_x" }],
  ["UCabcdefghijklmnopqrstuv", { kind: "id", id: "UCabcdefghijklmnopqrstuv" }],
  ["https://youtube.com/channel/UCabcdefghijklmnopqrstuv?si=1", { kind: "id", id: "UCabcdefghijklmnopqrstuv" }],
])("parses %s", (input, ref) => expect(parseChannelInput(input)).toEqual({ ok: true, ref }));

it("rejects legacy /c/ and /user/ URLs with guidance", () => {
  const r = parseChannelInput("https://www.youtube.com/c/Nome");
  expect(r).toMatchObject({ ok: false });
  expect((r as any).error).toMatch(/@/); // orienta a usar o @handle
});
it("rejects empty and video URLs", () => {
  expect(parseChannelInput("  ").ok).toBe(false);
  expect(parseChannelInput("https://www.youtube.com/watch?v=abc").ok).toBe(false);
});
it.each([["PT1H2M3S", 3723], ["PT59S", 59], ["PT3M", 180], ["P0D", 0], ["P1DT1S", 86401]])("duration %s", (iso, s) =>
  expect(parseIsoDuration(iso)).toBe(s));
it("derives playlist ids", () => {
  expect(longVideosPlaylistId("UCabc")).toBe("UULFabc");
  expect(livesPlaylistId("UCabc")).toBe("UULVabc");
  expect(uploadsPlaylistId("UCabc")).toBe("UUabc");
});
```

- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3: Implementar.** IDs de canal: `^UC[\w-]{22}$`. Handle: `[\w.-]{3,30}` depois do `@`. Mensagens de erro em português, por exemplo: "Esse formato de link antigo não é suportado. Abra o canal e copie o link com @".
- [ ] **Step 4:** rodar → PASS.
- [ ] **Step 5: Commit** `feat: parse channel inputs, ISO durations and playlist ids`

---

### Task 4: Cliente da YouTube Data API e checagem de Shorts

**Files:**
- Create: `src/lib/youtube/client.ts`, `src/lib/youtube/shorts-probe.ts`
- Test: `tests/lib/youtube/client.test.ts`, `tests/lib/youtube/shorts-probe.test.ts`

**Interfaces:**
- Consumes: `ChannelRef`, `parseIsoDuration` (Task 3).
- Produces:

```ts
export interface ChannelInfo { id: string; title: string; handle: string | null; avatarUrl: string }
export interface VideoDetails {
  id: string; channelId: string; title: string; description: string; publishedAt: Date;
  durationSeconds: number; thumbnailUrl: string; embeddable: boolean;
  liveBroadcastContent: "none" | "live" | "upcoming"; liveActualEndTime: Date | null;
}
export interface YouTubeClient {
  getChannel(ref: ChannelRef): Promise<ChannelInfo | null>;
  listPlaylistPage(playlistId: string, pageToken?: string): Promise<{ videoIds: string[]; nextPageToken?: string }>;
  getVideos(ids: string[]): Promise<VideoDetails[]>; // divide em lotes de 50
}
export class YouTubeApiError extends Error { status: number; reason: string }
export const isPlaylistNotFound: (e: unknown) => boolean; // 404 ou reason "playlistNotFound"
export const isQuotaExceeded: (e: unknown) => boolean;    // reason "quotaExceeded" ou "dailyLimitExceeded"
export function createYouTubeClient(apiKey: string, fetchFn?: typeof fetch): YouTubeClient;

export type ProbeResult = "short" | "not_short" | "unknown";
export function probeShort(videoId: string, fetchFn?: typeof fetch): Promise<ProbeResult>;
```

- [ ] **Step 1: Testes que falham** (todos com `fetchFn` falso, sem rede):

```ts
it("getChannel by handle calls channels.list?forHandle and maps fields", ...);   // part=snippet, key presente na URL
it("getChannel returns null when items is empty", ...);
it("listPlaylistPage maps contentDetails.videoId and nextPageToken", ...);       // maxResults=50
it("getVideos batches 120 ids into 3 calls with part=snippet,contentDetails,status,liveStreamingDetails", ...);
it("getVideos maps P0D upcoming live to durationSeconds 0 and liveBroadcastContent 'upcoming'", ...);
it("throws YouTubeApiError with reason from error.errors[0].reason", ...);
it("isQuotaExceeded true for 403 quotaExceeded", ...);
it("isPlaylistNotFound true for 404 playlistNotFound", ...);
// shorts-probe
it("200 → short", ...);
it("303 with Location containing /watch → not_short", ...);
it("302 to consent.youtube.com → unknown", ...);
it("429 → unknown", ...);
it("network error / timeout → unknown", ...);
it("requests https://www.youtube.com/shorts/{id} with redirect: 'manual'", ...);
```

- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3: Implementar.** Base `https://www.googleapis.com/youtube/v3`. Thumbnail: `maxres ?? high ?? medium ?? default`. Os dois arquivos começam com `import "server-only"` (no Vitest, faça `vi.mock("server-only", () => ({}))` em um setup file). Probe com `AbortSignal.timeout(5000)`. Status 3xx conta como `not_short` só se o `Location` apontar para `/watch`; qualquer outra resposta, ou exceção, devolve `unknown`.
- [ ] **Step 4:** rodar → PASS.
- [ ] **Step 5: Commit** `feat: YouTube Data API client and shorts probe`

---

### Task 5: Classificação e sincronização

**Files:**
- Create: `src/lib/sync/classify.ts`, `src/lib/sync/sync-channel.ts`, `src/lib/sync/run-sync.ts`
- Test: `tests/lib/sync/classify.test.ts`, `tests/lib/sync/sync-channel.test.ts`, `tests/lib/sync/run-sync.test.ts`, `tests/helpers/fake-youtube.ts`

**Interfaces:**
- Consumes: `Db`, `createTestDb` (Task 2); `YouTubeClient`, `VideoDetails`, `probeShort`, erros (Task 4); ids de playlist (Task 3).
- Produces:

```ts
// classify.ts
export interface Classification {
  durationSeconds: number;
  shortsCheck: "not_needed" | "pending";
  liveState: "none" | "pending" | "ended";
  isLiveRecording: boolean;
}
export function classifyVideo(d: VideoDetails): Classification;
export function applyProbeResult(
  prev: { shortsCheckFailures: number }, r: ProbeResult,
): { shortsCheck: "ok" | "short" | "pending"; shortsCheckFailures: number; isShort: boolean };

// sync-channel.ts
export interface SyncDeps { db: Db; yt: YouTubeClient; probe: (id: string) => Promise<ProbeResult>; now: Date }
export interface ChannelSyncResult { channelId: string; inserted: number; removed: number; backfillDone: boolean }
export function syncChannel(deps: SyncDeps, channelId: string): Promise<ChannelSyncResult>;

// run-sync.ts
export interface RunSyncResult { synced: number; remaining: number; stoppedReason: "done" | "budget" | "quota" }
export function runSync(deps: SyncDeps, opts?: { budgetMs?: number; nowMs?: () => number }): Promise<RunSyncResult>;
```

**Regras de `classifyVideo`:**
- `liveBroadcastContent` `live` ou `upcoming` → `liveState: "pending"`.
- `none` com `liveActualEndTime` → `"ended"`, `isLiveRecording: true`.
- Caso contrário → `"none"`.
- `shortsCheck` é `"pending"` se `durationSeconds <= SHORTS_MAX_SECONDS`, senão `"not_needed"`.

**Regras de `applyProbeResult`:**
- `short` → `short` + `isShort: true`.
- `not_short` → `ok`.
- `unknown` → `failures + 1`. Ao chegar a `MAX_PROBE_FAILURES`, vira `short` + `isShort: true`; antes disso, continua `pending`.

**Algoritmo de `syncChannel`** (o que a assinatura não determina):

```
channel = select (falha se não existir ou estiver removido)
firstImport = channel.lastSyncedAt == null
1. Vídeos longos: fonte = channel.longPlaylistMissing ? UU : UULF.
   Paginar do topo; parar na primeira página que contenha um id já salvo
   (na primeira importação, ir até MAX_PAGES_PER_RUN = 20 páginas e guardar
   nextPageToken em backfillPageToken).
   Se UULF der isPlaylistNotFound → marcar longPlaylistMissing = true e repetir com UU.
2. Lives: paginar UULV do mesmo jeito (sem backfill além de 20 páginas na primeira vez).
   isPlaylistNotFound → ignorar e seguir.
3. Backfill: se backfillPageToken existir e não for a primeira importação,
   continuar da fonte de vídeos longos por até MAX_PAGES_PER_RUN páginas e
   atualizar ou limpar o token.
4. Ids novos = coletados − já salvos. getVideos(novos) → classifyVideo →
   insert ... on conflict do nothing.
   inFeed = firstImport || veio do backfill
            ? publishedAt >= now − FEED_WINDOW_DAYS
            : true
   Ids pedidos que o getVideos não devolveu são ignorados.
5. Reavaliar vídeos do canal com liveState = 'pending': getVideos(ids) →
   reclassificar (atualiza duração, liveState, shortsCheck, shortsCheckFailures = 0).
   Ids que não voltaram → delete (cascade remove de playlists e watch_state).
6. Probe: vídeos do canal com shortsCheck = 'pending' e liveState != 'pending'
   (no máximo 50 por execução, concorrência 4) → applyProbeResult → update.
   Se a constante SHORTS_PROBE_ENABLED (em constants.ts, padrão true) for false,
   pular este passo: todo vídeo ≤ 180 s fica pendente, ou seja, escondido
   (regra de reserva do spec 6.3).
7. lastSyncedAt = now.
```

**`runSync`:**
- Canais não removidos, ordenados por `lastSyncedAt asc nulls first`, sincronizados um por vez enquanto `nowMs() - start < budgetMs` (padrão 45_000).
- Ao receber `isQuotaExceeded`, para na hora com `stoppedReason: "quota"`. O canal que estava sendo processado não recebe `lastSyncedAt`, para ser tentado de novo.
- Qualquer outro erro em um canal é registrado com `console.error`; os demais canais seguem.

- [ ] **Step 1: `tests/helpers/fake-youtube.ts`:** `createFakeYouTube({ channels, playlists: Record<playlistId, string[]>, videos: Record<id, VideoDetails>, missingPlaylists?: string[], quotaAfterCalls?: number })`, que pagina de 50 em 50 e registra as chamadas em `.calls`.
- [ ] **Step 2: Testes que falham** (PGlite + fake):

```ts
// classify
it("long regular video → not_needed / none");
it("180s video → pending (boundary inclusive)"); it("181s → not_needed");
it("upcoming live P0D → liveState pending"); it("ended live → ended + isLiveRecording");
it("probe unknown 4x stays pending, 5th becomes short");
// syncChannel
it("first import: videos older than 30 days get inFeed=false, newer true");
it("incremental: stops paging at first known id and new videos get inFeed=true");
it("UULF missing → uses UU, sets longPlaylistMissing, and a 60s video stays hidden until probe 'not_short'");
it("probe 'short' → isShort true; the video never appears in listFeed/searchVideos/listChannelVideos");
it("UULV missing → no error, long videos still synced");
it("pending live becomes ended on next sync and enters the feed");
it("pending video missing from videos.list is deleted and removed from playlists");
it("first import of 2500-video channel stores backfillPageToken; next run continues and clears it");
it("only calls channels/playlistItems/videos endpoints (never search)"); // checa fake.calls
// runSync
it("stops with 'budget' and reports remaining when budget exhausted");
it("stops with 'quota' on quotaExceeded and leaves that channel's lastSyncedAt untouched");
it("an error in one channel does not stop the others");
```

O teste "never appears" importa `listFeed`, `searchVideos` e `listChannelVideos` da Task 6. Escreva-o aqui marcado com `it.todo` e ative-o na Task 6.

- [ ] **Step 3:** `npm test -- tests/lib/sync` → FAIL.
- [ ] **Step 4: Implementar** `classify.ts`, `sync-channel.ts` e `run-sync.ts` conforme as regras acima.
- [ ] **Step 5:** rodar → PASS.
- [ ] **Step 6: Commit** `feat: channel sync with shorts filtering, live recordings and backfill`

---

### Task 6: Consultas (visibilidade, feed, canal, busca, progresso)

**Files:**
- Create: `src/lib/queries/visibility.ts`, `src/lib/queries/videos.ts`, `src/lib/queries/watch.ts`
- Test: `tests/lib/queries/videos.test.ts`, `tests/lib/queries/watch.test.ts`

**Interfaces:**
- Consumes: `Db`, schema (Task 2).
- Produces:

```ts
export function visibleVideoCondition(): SQL; // is_short = false AND shorts_check IN ('not_needed','ok') AND live_state IN ('none','ended')
export interface VideoCardData {
  id: string; title: string; channelId: string; channelTitle: string; channelAvatarUrl: string;
  publishedAt: Date; durationSeconds: number; thumbnailUrl: string; embeddable: boolean;
  isLiveRecording: boolean; positionSeconds: number; watched: boolean;
}
export function listFeed(db: Db, opts: { categoryId?: number; limit: number }): Promise<{ items: VideoCardData[]; hasMore: boolean }>;
export function listChannelVideos(db: Db, channelId: string, opts: { limit: number }): Promise<{ items: VideoCardData[]; hasMore: boolean }>;
export function searchVideos(db: Db, q: string, opts: { limit: number }): Promise<{ items: VideoCardData[]; hasMore: boolean }>;
export function getVisibleVideo(db: Db, id: string): Promise<(VideoCardData & { description: string }) | null>;

export function saveProgress(db: Db, videoId: string, positionSeconds: number, durationSeconds: number): Promise<{ watched: boolean }>;
export function setWatched(db: Db, videoId: string, watched: boolean): Promise<void>;
export function dismissFromFeed(db: Db, videoId: string): Promise<void>;
```

**Regras:**
- **Feed:** `visible AND in_feed AND dismissed_at IS NULL AND NOT coalesce(watched,false) AND channel.removed_at IS NULL [AND channel.category_id = ?]`, ordenado por `published_at desc`.
- **Canal:** `visible AND channel_id = ?` (inclui assistidos), ordenado por `published_at desc`.
- **Busca:** `visible AND channel.removed_at IS NULL AND search_vector @@ websearch_to_tsquery('portuguese', q)`, ordenado por `ts_rank desc, published_at desc`. Consulta vazia devolve lista vazia.
- **`getVisibleVideo`:** devolve `null` se o vídeo não for visível. Vídeo de canal removido continua acessível (pode estar numa playlist).
- **`hasMore`:** buscar `limit + 1`.
- **`saveProgress`:** upsert. Marca `watched` quando `shouldMarkWatched(position, duration)` (Task 9), mas nunca desmarca.

- [ ] **Step 1: Testes que falham**, incluindo os de Review Focus:

```ts
it("feed excludes shorts, pending-check, pending-live, watched, dismissed, removed-channel and in_feed=false videos");
it("feed filters by category and orders newest first");
it("feed returns hasMore when more than limit");
it("feed is empty when all caught up");                         // base do "Você está em dia"
it("channel page includes watched videos but never shorts");
it("search finds by description word and excludes shorts");
it("getVisibleVideo returns null for a short and for live_state pending");
it("getVisibleVideo returns embeddable=false videos (UI shows fallback)");
it("saveProgress at 90% marks watched; later lower position keeps watched");
it("dismissFromFeed hides from feed but does not mark watched");
```

E ative o `it.todo` da Task 5.

- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3: Implementar.** Um único `select` base com `left join watch_state` e `join channels` reaproveitado pelas 4 listagens.
- [ ] **Step 4:** `npm test` → PASS (inclui o teste ativado da Task 5).
- [ ] **Step 5: Commit** `feat: video queries with single visibility filter`

---

### Task 7: Login, sessão, middleware e rota do cron

**Files:**
- Create: `src/lib/auth/session.ts`, `src/middleware.ts` (ou `src/proxy.ts` se a versão instalada do Next já tiver renomeado o middleware), `src/app/login/page.tsx`, `src/app/login/actions.ts`, `src/app/api/cron/sync/route.ts`, `vercel.json`
- Test: `tests/lib/auth/session.test.ts`, `tests/app/cron-route.test.ts`

**Interfaces:**
- Consumes: `getEnv` (Task 1); `runSync`, `createYouTubeClient`, `probeShort`, `getDb` (Tasks 2, 4, 5).
- Produces:

```ts
export const SESSION_COOKIE = "zt_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;
export function createSessionToken(secret: string): Promise<string>;           // JWT HS256 via jose, exp 90 dias
export function verifySessionToken(token: string | undefined, secret: string): Promise<boolean>;
export function checkPassword(input: string, expected: string): boolean;       // sha256 + timingSafeEqual
export function isPublicPath(pathname: string): boolean;
export function createSyncDeps(): SyncDeps;                                    // em src/lib/sync/run-sync.ts: monta deps reais
```

**Rotas públicas:** `/login`, `/api/cron/sync`, `/_next/*`, `/manifest.webmanifest`, `/icon*`, `/apple-icon*`, `/favicon.ico`.

- [ ] **Step 1: Testes que falham:**

```ts
it("token roundtrip verifies; wrong secret fails; garbage fails; undefined fails");
it("checkPassword true only for exact match, false for different length");
it.each(["/login", "/api/cron/sync", "/_next/static/x.js", "/manifest.webmanifest"])("public %s");
it.each(["/", "/watch/abc", "/channels", "/api/anything"])("private %s");
it("cron GET without Authorization: Bearer CRON_SECRET → 401 and runSync not called"); // vi.mock run-sync
it("cron GET with correct bearer → 200 JSON with runSync result");
```

- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3: Implementar.**
  - **Middleware:** redireciona para `/login?next=…` sem sessão válida. Sem sessão, rotas `/api/*` recebem 401.
  - **Login:** formulário de senha. A Server Action valida, grava o cookie (`httpOnly`, `secure` em produção, `sameSite: "lax"`, `maxAge` 90 dias) e redireciona para `next`. Senha errada mostra "Senha incorreta".
  - **Rota do cron:** `export const maxDuration = 60`, `dynamic = "force-dynamic"`, responde com o resultado de `runSync(createSyncDeps())`.
  - **`vercel.json`:** `{ "crons": [{ "path": "/api/cron/sync", "schedule": "0 9 * * *" }] }` (06:00 em Brasília).
- [ ] **Step 4:** rodar → PASS.
- [ ] **Step 5: Commit** `feat: password login, session middleware and daily cron route`

---

### Task 8: Shell visual, feed e canais

**Files:**
- Create: `src/lib/queries/channels.ts`, `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx`, `src/app/(app)/actions.ts`, `src/app/(app)/channels/page.tsx`, `src/app/(app)/channels/actions.ts`, `src/app/(app)/channel/[id]/page.tsx`, `src/components/{Nav,VideoCard,VideoGrid,CategoryFilter,SyncButton,LoadMore}.tsx`, `src/app/manifest.ts`, `public/icon.svg`, `public/icon-192.png`, `public/icon-512.png`
- Test: `tests/lib/queries/channels.test.ts`

**Interfaces:**
- Consumes: Tasks 3–7.
- Produces:

```ts
// queries/channels.ts
export function listChannels(db: Db): Promise<Array<{ id: string; title: string; handle: string | null; avatarUrl: string; categoryId: number | null; lastSyncedAt: Date | null }>>;
export function upsertChannel(db: Db, info: ChannelInfo): Promise<void>;          // reativa (removedAt = null) se já existia
export function removeChannel(db: Db, id: string): Promise<void>;                 // removedAt = now
export function setChannelCategory(db: Db, id: string, categoryId: number | null): Promise<void>;
export function listCategories(db: Db): Promise<Array<{ id: number; name: string }>>;
export function createCategory(db: Db, name: string): Promise<number>;
export function renameCategory(db: Db, id: number, name: string): Promise<void>;
export function deleteCategory(db: Db, id: number): Promise<void>;                // canais ficam sem categoria
// (app)/channels/actions.ts
export async function addChannelAction(prev: ActionState, form: FormData): Promise<ActionState>; // { ok: boolean; message: string }
// (app)/actions.ts
export async function syncNowAction(): Promise<{ message: string }>;
export async function dismissAction(videoId: string): Promise<void>;
export async function setWatchedAction(videoId: string, watched: boolean): Promise<void>;
```

- [ ] **Step 1: Testes que falham** (queries de canais):

```ts
it("removeChannel hides its videos from feed/search but keeps them in playlists"); // usa listFeed/searchVideos da Task 6
it("upsertChannel on a removed channel reactivates it");
it("deleteCategory sets channels.categoryId to null");
it("createCategory rejects duplicate names");
```

- [ ] **Step 2:** rodar → FAIL; implementar as queries; rodar → PASS.
- [ ] **Step 3: `addChannelAction`:** `parseChannelInput` → `getChannel` (null → "Canal não encontrado") → `upsertChannel` → `syncChannel` (primeira importação) → `revalidatePath`. Mensagem de sucesso: "Canal adicionado: {título} ({n} vídeos)". Cota esgotada → "Cota diária da API esgotada. Tente amanhã."
- [ ] **Step 4: `syncNowAction`** usa `runSync` com `budgetMs: 45_000`. Mensagens:
  - `done`: "Tudo atualizado"
  - `budget`: "Atualizados {n} canais; o resto continua na próxima atualização"
  - `quota`: "Cota diária da API esgotada"
- [ ] **Step 5: Shell.**
  - `Nav`: barra lateral fixa em `md:` e barra inferior no celular. Itens: Início, Canais, Playlists, Busca. Logo "ZamparTube" com ícone azul.
  - `SyncButton` no topo, mostrando a mensagem da action.
  - `VideoCard`: thumbnail com duração e barra de progresso azul, título (2 linhas), canal, data relativa em pt-BR, selo "Gravação de live" quando `isLiveRecording`, e o botão "Dispensar" (só quando o card recebe a prop `onFeed`).
- [ ] **Step 6: Feed** (`(app)/page.tsx`):
  - `CategoryFilter` como chips ("Todos" + categorias), lendo `?categoria=id`.
  - Grade com `listFeed`, `limit` vindo de `?n=` (padrão 24, `LoadMore` soma 24).
  - Lista vazia ou sem `hasMore`: bloco final "Você está em dia ✓".
  - Sem nenhum canal: convite "Adicione seu primeiro canal" com link para `/channels`.
- [ ] **Step 7: Canais e página do canal.**
  - `/channels`: formulário de adicionar (input + select de categoria), lista com troca de categoria, botão remover com `confirm`, e seção de categorias (criar, renomear, apagar).
  - `/channel/[id]`: cabeçalho com avatar e nome, e grade `listChannelVideos` com `LoadMore`.
- [ ] **Step 8: PWA.**
  - `manifest.ts`: `name` "ZamparTube", `display: "standalone"`, `background_color` e `theme_color` `#0B0F17`, ícones 192/512.
  - `icon.svg`: ícone azul simples (play arredondado em `#3B82F6` sobre `#0B0F17`, ou um "Z").
  - PNGs gerados do SVG (por exemplo `npx sharp-cli`).
- [ ] **Step 9:** `npm test` → PASS; `npm run build` → sucesso; `npm run lint` sem erros.
- [ ] **Step 10: Commit** `feat: app shell, feed with end state, channel management`

---

### Task 9: Tela de vídeo e player

**Files:**
- Create: `src/lib/player/progress.ts`, `src/app/(app)/watch/[id]/page.tsx`, `src/components/Player.tsx` (client), `src/components/EndScreen.tsx`
- Modify: `src/app/(app)/actions.ts` (adicionar `saveProgressAction`)
- Test: `tests/lib/player/progress.test.ts`

**Interfaces:**
- Consumes: `getVisibleVideo`, `saveProgress`, `setWatched` (Task 6); `getNextInPlaylist` (Task 10, opcional nesta task: se não existir ainda, a tela final não mostra "Próximo").
- Produces:

```ts
export function shouldMarkWatched(positionSeconds: number, durationSeconds: number): boolean; // duration > 0 && pos >= 0.9*duration
export function resumeFrom(state: { positionSeconds: number; watched: boolean } | null, durationSeconds: number): number;
// 0 se assistido, sem estado, ou se pos >= duration - 10; senão floor(pos)
export async function saveProgressAction(videoId: string, positionSeconds: number, durationSeconds: number): Promise<{ watched: boolean }>;
```

> `shouldMarkWatched` é usado por `saveProgress` (Task 6). Se a Task 6 vier antes, crie `progress.ts` lá e só complete os testes aqui.

- [ ] **Step 1: Testes que falham:**

```ts
it("90% marks watched, 89% does not, duration 0 never");
it("resumeFrom: watched → 0; null → 0; near end → 0; mid → floor(pos)");
```

- [ ] **Step 2:** rodar → FAIL; implementar; rodar → PASS.
- [ ] **Step 3: Página `/watch/[id]?list=…`.**
  - `getVisibleVideo` → `notFound()` se `null`.
  - Layout: player 16:9, título, canal (link), data, descrição recolhível ("Mostrar mais"), botões "Assistido" (alterna), "Assistir depois" e "Adicionar à playlist" (Task 10).
  - Nenhuma lista de vídeos relacionados.
  - `embeddable = false` → thumbnail + botão "Abrir no YouTube" (`target="_blank" rel="noopener"`), sem player.
- [ ] **Step 4: `Player`.**
  - Carrega `https://www.youtube.com/iframe_api` uma vez e cria `YT.Player` com `playerVars: { rel: 0, iv_load_policy: 3, modestbranding: 1, playsinline: 1, start: resumeFrom(...) }`.
  - Salva o progresso a cada `PROGRESS_SAVE_INTERVAL_MS` enquanto toca, em `PAUSED` e em `visibilitychange`/`pagehide`.
  - Em `ENDED`: `saveProgressAction(id, duration, duration)`, `player.destroy()` e renderiza `EndScreen`.
- [ ] **Step 5: `EndScreen`.** "Marcado como assistido ✓", "Voltar ao feed" e, se `?list=` existir e houver próximo, "Próximo da playlist" (link, sem autoplay).
- [ ] **Step 6: Verificação manual** com `npm run dev`, `.env.local` preenchido e um canal real:
  - o vídeo retoma da posição salva;
  - ao terminar aparece a tela final e não a grade do YouTube;
  - com 90% assistidos, o vídeo some do feed.
- [ ] **Step 7: Commit** `feat: watch page with resumable player and custom end screen`

---

### Task 10: Playlists e "Assistir depois"

**Files:**
- Create: `src/lib/queries/playlists.ts`, `src/app/(app)/playlists/page.tsx`, `src/app/(app)/playlists/[id]/page.tsx`, `src/app/(app)/playlists/actions.ts`, `src/components/AddToPlaylistMenu.tsx`
- Test: `tests/lib/queries/playlists.test.ts`

**Interfaces:**
- Consumes: `visibleVideoCondition`, `VideoCardData` (Task 6).
- Produces:

```ts
export function listPlaylists(db: Db): Promise<Array<{ id: number; name: string; isWatchLater: boolean; count: number; coverThumbnailUrl: string | null }>>; // watch later primeiro
export function getWatchLaterId(db: Db): Promise<number>;
export function createPlaylist(db: Db, name: string): Promise<number>;
export function renamePlaylist(db: Db, id: number, name: string): Promise<void>;
export function deletePlaylist(db: Db, id: number): Promise<void>;                 // erro se isWatchLater
export function addToPlaylist(db: Db, playlistId: number, videoId: string): Promise<void>; // no fim; idempotente
export function removeFromPlaylist(db: Db, playlistId: number, videoId: string): Promise<void>;
export function moveInPlaylist(db: Db, playlistId: number, videoId: string, direction: "up" | "down"): Promise<void>;
export function listPlaylistVideos(db: Db, playlistId: number): Promise<VideoCardData[]>; // por position, só visíveis
export function getNextInPlaylist(db: Db, playlistId: number, currentVideoId: string): Promise<string | null>;
export function playlistsContaining(db: Db, videoId: string): Promise<number[]>;
```

Reordenação com botões ↑/↓ (decisão minha: mais simples e confiável no celular do que arrastar). `moveInPlaylist` troca `position` com o vizinho visível numa única instrução `UPDATE … CASE`.

- [ ] **Step 1: Testes que falham:**

```ts
it("watch later cannot be deleted");
it("addToPlaylist appends at the end and is idempotent");
it("moveInPlaylist up/down swaps with neighbour; no-op at edges");
it("listPlaylistVideos hides a video that later became short");
it("getNextInPlaylist returns next visible item or null at end");
it("deleting a video row cascades out of playlists"); // ligado à Review Focus 4
```

- [ ] **Step 2:** rodar → FAIL; implementar; rodar → PASS.
- [ ] **Step 3: Telas.**
  - `/playlists`: "Assistir depois" fixa no topo, as outras abaixo, e um botão "Nova playlist".
  - `/playlists/[id]`: renomear, apagar (oculto em "Assistir depois"), lista com ↑ ↓ ✕ e botão "Tocar a seguir" que abre o primeiro vídeo não assistido com `?list=`.
  - `AddToPlaylistMenu` na tela de vídeo: checkboxes por playlist (`playlistsContaining`) e "Nova playlist…".
  - O botão "Assistir depois" da tela de vídeo usa `getWatchLaterId`.
- [ ] **Step 4:** ligar o "Próximo da playlist" da Task 9 a `getNextInPlaylist`.
- [ ] **Step 5:** `npm test` → PASS; `npm run build` → sucesso.
- [ ] **Step 6: Commit** `feat: personal playlists with watch later`

---

### Task 11: Busca

**Files:**
- Create: `src/app/(app)/search/page.tsx`

**Interfaces:**
- Consumes: `searchVideos` (Task 6, já testado).

- [ ] **Step 1: Página `/search?q=`.**
  - Input com foco automático (formulário GET).
  - Grade de resultados com `LoadMore`.
  - Sem `q`: texto "Busque nos vídeos dos seus canais".
  - Sem resultados: "Nada encontrado nos seus canais".
- [ ] **Step 2:** `npm run build` → sucesso; verificação manual de uma busca por palavra da descrição.
- [ ] **Step 3: Commit** `feat: local search page`

---

### Task 12: Publicação e verificação final

**Files:**
- Create: `README.md` (em português)

**Depende do usuário** (pausar e pedir):
- connection string do Neon;
- projeto criado na Vercel com as 5 variáveis de ambiente (`CRON_SECRET` gerado com `openssl rand -hex 32` ou equivalente; `SESSION_SECRET` idem);
- confirmação de que a chave da API foi restrita à YouTube Data API v3.

- [ ] **Step 1: README.**
  - Como rodar local: `.env.local`, `npx drizzle-kit migrate`, `npm run dev`.
  - Como publicar: Vercel + variáveis.
  - O que cada variável faz.
  - Limitações conhecidas: playlists `UULF`/`UULV` fora da documentação oficial; links que o criador coloca dentro do vídeo; a busca diferencia acentos, se for o caso.
- [ ] **Step 2:** rodar a migration no Neon: `npx drizzle-kit migrate` com o `DATABASE_URL` do Neon.
- [ ] **Step 3:** deploy na Vercel (via Git ou `npx vercel --prod`) e confirmar que o cron aparece em *Settings → Cron Jobs*.
- [ ] **Step 4: Verificação ponta a ponta** no site publicado, no navegador:
  - [ ] sem cookie, `/` redireciona para `/login`; com senha errada aparece "Senha incorreta";
  - [ ] adicionar 2–3 canais reais, incluindo um que publique muitos Shorts: nenhum Short no feed, na página do canal ou na busca;
  - [ ] o feed termina com "Você está em dia" depois de dispensar ou assistir tudo;
  - [ ] o vídeo retoma de onde parou e a tela final é a do ZamparTube;
  - [ ] playlist criada, reordenada e tocada com "Próximo da playlist";
  - [ ] "Atualizar agora" mostra a mensagem;
  - [ ] `GET /api/cron/sync` sem token responde 401;
  - [ ] no celular (largura 375 px): barra inferior, sem rolagem horizontal, e "Adicionar à tela inicial" disponível.
- [ ] **Step 5: Commit** `docs: README with setup and deploy instructions`
