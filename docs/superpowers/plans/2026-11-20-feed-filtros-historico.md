# Feed: filtros, busca, histórico e ações rápidas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Multi-select category/channel filters and search on the home feed, a 14-day feed window, live recordings hidden everywhere, a history page, and quick "watch later"/"dismiss" actions on video cards (⋮ menu on phones).

**Architecture:** Query changes live in `src/lib/queries/*` (tested against PGlite via `createTestDb`). URL ⇄ filter parsing is a pure module `src/lib/feed-filters.ts`. UI is Next.js 16 server pages plus small client components; menus use `@radix-ui/react-dropdown-menu` styled like `src/components/ui/Select.tsx`.

**Tech Stack:** Next.js 16.4 (App Router, read `node_modules/next/dist/docs/` before using unfamiliar APIs), React 19.3, Drizzle ORM, PGlite (tests/dev), Neon (prod), Tailwind 4, Radix, lucide-react, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-20-feed-filtros-historico-design.md`

## Global Constraints

- All UI copy in pt-BR, exactly as in the spec ("Assistir depois", "Salvar para assistir depois", "Remover de Assistir depois", "Dispensar do feed", "Todos", "Todos os canais", "N canais", "Limpar seleção", "Histórico", "Continuar assistindo", "Assistidos").
- Feed window: 14 days by `published_at`, computed in the query; `FEED_WINDOW_DAYS = 14`.
- `WATCHED_RATIO` stays 0.9.
- URL params: `categoria` (comma-separated category ids), `canal` (comma-separated channel ids), `q` (search), `n` (page size, existing).
- Only new dependency: `@radix-ui/react-dropdown-menu`.
- No git commits unless the user asks (session rule); run `npm test` and `npx tsc --noEmit` at the end of every task.

## Review Focus

1. Stale/invalid URL ids (`?categoria=999&canal=xyz`, empty segments `1,,3`) → ignored, feed still renders.
2. A selected channel whose category gets deselected → dropped from `canal` when the chip URL is built.
3. Watch-later toggle from a card on a page other than `/` (channel, search results, history) → the card's state updates after the action (revalidate the layout, not only `/`).
4. Touch devices (no hover) → the ⋮ button is always visible and the hover icons are not; keyboard users can reach both on desktop.
5. A live recording already in "Assistir depois" or in history → hidden there too, and `/watch/[id]` 404s.

---

### Task 1: Hide live recordings everywhere

**Files:**
- Modify: `src/lib/queries/visibility.ts`, `src/components/VideoCard.tsx` (drop the "Gravação de live" badge and `Radio` import), `README.md` (feature list line about live recordings → "Gravações de lives ficam de fora")
- Test: `tests/lib/queries/videos.test.ts`, `tests/lib/queries/playlists.test.ts`

**Interfaces:** Produces: `visibleVideoCondition()` now also requires `videos.isLiveRecording = false`.

- [ ] **Step 1: Tests.** In `videos.test.ts` change the first `listFeed` expectation to `["ok", "probed-ok"]` (the `rec` video is gone). Add `it("hides live recordings from search, channel and watch page")`: insert `rec` with `{ liveState: "ended", isLiveRecording: true, title: "Live gravada" }`; expect `ids(await searchVideos(db, "gravada", { limit: 10 }))` toEqual `[]`, `ids(await listChannelVideos(db, CH_A, { limit: 10 }))` toEqual `[]`, `await getVisibleVideo(db, "rec")` toBeNull. In `playlists.test.ts` add a test that a live recording added to a playlist is not returned by `listPlaylistVideos`.
- [ ] **Step 2:** `npx vitest run tests/lib/queries` → the new assertions FAIL.
- [ ] **Step 3:** Add `eq(videos.isLiveRecording, false)` to `visibleVideoCondition`; update its doc comment. Remove the badge in `VideoCard`.
- [ ] **Step 4:** `npm test` → PASS.

### Task 2: Feed query — multi filters, 14-day window, `savedForLater`

**Files:**
- Modify: `src/lib/constants.ts` (`FEED_WINDOW_DAYS = 14`, comment: also the feed's visible window), `src/lib/queries/videos.ts`
- Test: `tests/lib/queries/videos.test.ts` (and any other test that calls `listFeed`)

**Interfaces:**
- Produces: `listFeed(db, opts: { categoryIds?: number[]; channelIds?: string[]; limit: number; now?: Date }): Promise<VideoPage>` — empty/undefined arrays mean "no filter"; categories OR'd, channels OR'd, both lists AND'd; `publishedAt >= now - FEED_WINDOW_DAYS days` (`now` defaults to `new Date()`).
- Produces: `VideoCardData.savedForLater: boolean` added to `cardFields` (an `exists` subquery over `playlist_items` ⨝ `playlists` where `is_watch_later = true` and `video_id = videos.id`), so every card query returns it.

- [ ] **Step 1: Tests.** Pass `now: NOW` to every existing `listFeed` call. Replace the category test's `categoryId: cat` with `categoryIds: [cat]`. Add:
  - `it("filters by several categories")`: CH_A in cat1, CH_B in cat2, a third channel CH_C (new constant in the test, `"UCcccccccccccccccccccccc"`) uncategorized, one video each → `categoryIds: [cat1, cat2]` returns the CH_A and CH_B videos only.
  - `it("filters by several channels and combines with categories")`: `channelIds: [CH_A, CH_C]` → those two; `categoryIds: [cat1], channelIds: [CH_B]` → `[]`.
  - `it("only shows the last 14 days")`: videos at `daysAgo(13)` and `daysAgo(15)` → only the 13-day one with `now: NOW`.
  - `it("marks cards saved for later")`: add a video to `getWatchLaterId(db)` via `addToPlaylist`; `listFeed` item has `savedForLater: true`, another has `false`.
- [ ] **Step 2:** `npx vitest run tests/lib/queries/videos.test.ts` → FAIL.
- [ ] **Step 3:** Implement `listFeed` and `savedForLater` as in Interfaces (`inArray` for the lists).
- [ ] **Step 4:** `npm test` and `npx tsc --noEmit` → PASS (fix the home page call temporarily to `categoryIds: categoryId ? [categoryId] : undefined`; Task 5 replaces it).

### Task 3: History queries

**Files:**
- Create: `src/lib/queries/history.ts`
- Test: `tests/lib/queries/history.test.ts`

**Interfaces:**
- Produces: `listContinueWatching(db, opts: { limit: number }): Promise<VideoPage>` — visible videos with `watch_state.position_seconds > 0` and `watched = false`, `updated_at` desc, removed channels excluded, no feed window, dismissed ones included.
- Produces: `listWatchedHistory(db, opts: { limit: number }): Promise<VideoPage>` — visible videos with `watched = true`, `updated_at` desc, removed channels excluded.
- Both use `cardFields` from `videos.ts` (export the internal `toPage` helper from `videos.ts` and reuse it).

- [ ] **Step 1: Tests.** `continue watching lists started, unfinished videos, most recent first` (three videos: started at T1, started at T2 > T1, never started → `[T2, T1]`); `watched history lists watched videos, most recent first, and excludes unfinished`; `history hides live recordings and removed channels`; `hasMore` on `limit: 1` with two items.
- [ ] **Step 2:** `npx vitest run tests/lib/queries/history.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` → PASS.

### Task 4: URL ⇄ feed filter helpers

**Files:**
- Create: `src/lib/feed-filters.ts`
- Test: `tests/lib/feed-filters.test.ts`

**Interfaces:**
- Produces: `type FeedFilters = { categoryIds: number[]; channelIds: string[] }`.
- Produces: `parseFeedFilters(sp: { categoria?: string | string[]; canal?: string | string[] }, valid: { categoryIds: number[]; channels: Array<{ id: string; categoryId: number | null }> }): FeedFilters` — splits on `,`, drops empty/unknown ids and duplicates, keeps order of `valid`; drops channels whose category is not selected when any category is selected.
- Produces: `feedHref(f: FeedFilters): string` — `"/"` when empty, else `/?categoria=…&canal=…` (only non-empty params, ids joined with `,`, commas not percent-encoded).
- Produces: `toggleCategory(f: FeedFilters, id: number, channels: Array<{ id: string; categoryId: number | null }>): FeedFilters` — toggles `id`, then drops channels outside the new category set (no-op when the new set is empty).

- [ ] **Step 1: Tests.** `parseFeedFilters({ categoria: "1,,3,999", canal: "UCa,xyz" }, …)` → `{ categoryIds: [1, 3], channelIds: ["UCa"] }`; array input uses the first element; channel outside selected categories dropped; `feedHref({categoryIds:[],channelIds:[]})` → `"/"`; `feedHref({categoryIds:[1,3],channelIds:["UCa"]})` → `"/?categoria=1,3&canal=UCa"`; `toggleCategory` add/remove and the drop rule.
- [ ] **Step 2:** `npx vitest run tests/lib/feed-filters.test.ts` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` → PASS.

### Task 5: Home page — search box, multi-select chips, channel menu, nav

**Files:**
- Modify: `package.json` (`npm install @radix-ui/react-dropdown-menu`), `src/app/(app)/page.tsx`, `src/components/CategoryFilter.tsx`, `src/components/Nav.tsx`, `src/app/(app)/search/page.tsx` (becomes a redirect), `src/app/globals.css` (reuse the `select-in` keyframes; add nothing if it already fits)
- Create: `src/components/ChannelFilter.tsx` (client), `src/components/HomeSearch.tsx` (server-renderable form)

**Interfaces:**
- Consumes: `parseFeedFilters`, `feedHref`, `toggleCategory` (Task 4); `listFeed` (Task 2); `searchVideos` (existing).
- Produces: `CategoryFilter({ categories, channels, filters })` — chips are `<Link href={feedHref(toggleCategory(...))}>`; "Todos" links to `feedHref({ categoryIds: [], channelIds: filters.channelIds })`; active chips use the existing active style.
- Produces: `ChannelFilter({ channels: Array<{ id; title; avatarSrc }>, filters })` — Radix `DropdownMenu` with `CheckboxItem`s (avatar 20px via `ChannelAvatar` + title) and a "Limpar seleção" item; trigger styled exactly like `Select`'s trigger; content styled like `Select`'s content (max height 18rem, scroll). Local selection state; on `onOpenChange(false)` if changed, `router.push(feedHref({ ...filters, channelIds }), { scroll: false })`. Trigger label: none → "Todos os canais"; one → avatar + title; several → up to 3 overlapped avatars + "N canais".
- Home page: reads `q`; when `q` non-empty renders `HomeSearch` + results (with ✕ link to `feedHref(filters)`), hides filters, `LoadMore` params `{ q }`. Otherwise renders `HomeSearch`, `CategoryFilter`, `ChannelFilter` (channels limited to selected categories), feed with `LoadMore` params from the filters.
- Nav: replace the "Busca" item with `{ href: "/history", label: "Histórico", icon: History, match: p => p.startsWith("/history") }`.
- `/search?q=x` → `redirect("/?q=x")` (`/` when no `q`).

- [ ] **Step 1:** Install the dependency; `npx tsc --noEmit` clean.
- [ ] **Step 2:** Implement the components and page.
- [ ] **Step 3:** `npm test`, `npx tsc --noEmit`, `npm run lint` → PASS.
- [ ] **Step 4:** Browser check (preview `zampartube-dev`): select two chips, pick two channels, close the menu → URL and feed update; search → results, ✕ returns to the filtered feed; `/search?q=a` redirects; no console errors.

### Task 6: Card quick actions (hover icons + ⋮ menu)

**Files:**
- Create: `src/components/CardActions.tsx` (client)
- Modify: `src/components/VideoCard.tsx`, `src/app/(app)/actions.ts`, `src/app/(app)/playlists/actions.ts` (`setWatchLaterAction` must `revalidatePath("/", "layout")`)

**Interfaces:**
- Consumes: `VideoCardData.savedForLater` (Task 2), `setWatchLaterAction(videoId, inPlaylist)`, `dismissAction(videoId)`.
- Produces: `CardActions({ videoId, title, savedForLater, canDismiss })` — `useOptimistic` for the saved state.
  - Hover devices (`[@media(hover:hover)]`): two icon buttons (`Clock` / filled-accent when saved, `EyeOff` only when `canDismiss`), hidden until card hover/focus-within, like the current dismiss button. `aria-pressed` on the watch-later button; `title`/`aria-label` use the spec copy.
  - No-hover devices (`[@media(hover:none)]`): a `MoreVertical` button opening a Radix `DropdownMenu` (same content styling as Task 5) with "Salvar para assistir depois" / "Remover de Assistir depois" and, when `canDismiss`, "Dispensar do feed".
- `VideoCard` replaces its inline dismiss form with `<CardActions canDismiss={onFeed} …/>` on every card.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** `npm test`, `npx tsc --noEmit`, `npm run lint` → PASS.
- [ ] **Step 3:** Browser check desktop: hover shows both icons on the feed, only the clock on a channel page; saving shows it in `/playlists` "Assistir depois". Mobile preset: ⋮ visible, hover icons hidden, menu actions work.

### Task 7: History page

**Files:**
- Create: `src/app/(app)/history/page.tsx`
- Modify: `src/components/EmptyStates.tsx` (add `NoHistory`: "Nada por aqui ainda. Os vídeos que você começar a ver aparecem aqui."), `README.md` (feature list: filters, search on home, history, 14-day feed)

**Interfaces:**
- Consumes: `listContinueWatching`, `listWatchedHistory` (Task 3), `pageLimit`, `canLoadMore`, `LoadMore`.
- Page: `metadata.title = "Histórico · ZamparTube"`; `<h1>Histórico</h1>`; section "Continuar assistindo" (first 12, no paging) then section "Assistidos" paginated with `?n=` via `LoadMore basePath="/history"`; `NoHistory` when both empty.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** `npm test`, `npx tsc --noEmit`, `npm run lint` → PASS.
- [ ] **Step 3:** Browser check: play a video a few seconds, go to Histórico → it is under "Continuar assistindo" with progress; reopening resumes from that point.
