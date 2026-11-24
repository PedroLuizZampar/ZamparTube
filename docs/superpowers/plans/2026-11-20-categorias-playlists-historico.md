# Categorias, playlists e histórico — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Categories page, always-on category select, remove-from-history, unique playlist names with quick create +
inline rename, and feed filters on the history page.

**Architecture:** Query rules in `src/lib/queries/*` with PGlite tests; pages are server components with small client
forms; filter components get a `basePath` so home and history share them.

**Tech Stack:** Next.js 16.4.6, React 19.3, Drizzle (+ drizzle-kit generate), PGlite tests, Radix, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-11-20-categorias-playlists-historico-design.md`

## Global Constraints

- Copy in pt-BR exactly as the spec: "Categorias", "Criar", "Nova playlist", "Já existe uma playlist com esse nome.",
  "Remover do histórico", "Sem categoria".
- No commits unless the user asks. `npm test`, `npx tsc --noEmit`, `npm run lint` green at the end of every task.
- Migrations generated with `DATABASE_URL=postgresql://x@localhost/x npx drizzle-kit generate` (generate never connects),
  then hand-edited for data fixes; local DB updated with `npm run db:dev`.

## Review Focus

1. Renaming a playlist to its own name with different case ("estudos" → "Estudos") must succeed.
2. Two "Criar" clicks in a row produce "Nova playlist" and "Nova playlist 2" (no error).
3. History filters + "Carregar mais" keep the filter params.
4. Removing from history a video that is in "Assistir depois" keeps it in the playlist.
5. Category select with zero categories still submits `categoryId=""` (no category).

---

### Task 1: Unique playlist names and quick create (queries + migration)

**Files:** Modify `src/lib/db/schema.ts`, `src/lib/queries/playlists.ts`, `src/app/(app)/playlists/actions.ts`;
Create `drizzle/0003_*.sql` (generated + dedup UPDATE first); Test `tests/lib/queries/playlists.test.ts`.

**Interfaces (produces):**
- `class PlaylistNameTakenError extends Error` (exported from `playlists.ts`).
- `createPlaylist(db, name?: string): Promise<number>` — no name → first free of "Nova playlist", "Nova playlist 2", …;
  explicit name taken (case-insensitive) → `PlaylistNameTakenError`; blank → `Error`.
- `renamePlaylist(db, id, name)` — throws `PlaylistNameTakenError` if another playlist has it; throws for Watch Later.
- `createPlaylistQuickAction(): Promise<{ id: number }>`; `renamePlaylistAction` / `createPlaylistWithVideoAction`
  return message "Já existe uma playlist com esse nome." on `PlaylistNameTakenError`.

- [ ] Tests: `createPlaylist without a name picks the first free "Nova playlist" name` (→ "Nova playlist", "Nova playlist 2",
  "Nova playlist 3"); `createPlaylist rejects a name already used, ignoring case` ("Estudos" then "estudos"; also
  "assistir depois"); `renamePlaylist rejects another playlist's name but accepts a case change of its own`;
  `renamePlaylist refuses to rename Assistir depois`; `the database refuses duplicate names` (raw insert of "ESTUDOS" rejects).
- [ ] Run → FAIL. Implement (schema `uniqueIndex("playlists_name_lower_unique").on(sql\`lower(${t.name})\`)`). Generate
  migration, prepend dedup UPDATE. Run → PASS. `npm run db:dev`.

### Task 2: Remove from history + history filters (queries)

**Files:** Modify `src/lib/queries/watch.ts`, `src/lib/queries/history.ts`, `src/lib/queries/videos.ts`,
`src/app/(app)/actions.ts`; Test `tests/lib/queries/watch.test.ts`, `tests/lib/queries/history.test.ts`.

**Interfaces:**
- `clearWatchState(db, videoId): Promise<void>` (deletes the row); `removeFromHistoryAction(videoId)` (session,
  revalidate layout).
- `filterCondition(f: { categoryIds?: number[]; channelIds?: string[] }): SQL | undefined` exported from `videos.ts`,
  used by `listFeed`.
- `listContinueWatching(db, { limit, categoryIds?, channelIds? })`, `listWatchedHistory(db, { limit, categoryIds?, channelIds? })`.

- [ ] Tests: `clearWatchState removes progress and watched, keeps playlists`; `history lists filter by category and channel`.
- [ ] Run → FAIL. Implement. Run → PASS.

### Task 3: Categories page, nav, always-on select (UI)

**Files:** Create `src/app/(app)/categories/{page.tsx,CategoryForms.tsx,actions.ts}`; Modify `channels/page.tsx`,
`channels/ChannelForms.tsx`, `channels/actions.ts` (category actions move out), `src/components/Nav.tsx` (5 items,
`Tags` icon, bottom nav `grid-cols-5`).
- [ ] Implement; tsc/lint/test green.

### Task 4: Playlists page (UI)

**Files:** Modify `playlists/page.tsx`, `playlists/PlaylistForms.tsx`, `playlists/[id]/page.tsx` (no rename for Watch Later),
`src/components/AddToPlaylistMenu.tsx` (shows the action's message).
- `CreatePlaylistButton` → `createPlaylistQuickAction` → `router.push("/playlists?editar=<id>")`.
- Grid card for `editar` id renders `PlaylistNameEditor` (autofocus, ✓/✕, error line); save/cancel → `router.replace("/playlists")`.
- Pencil (`<Link href="?editar=id">`) on every card except Watch Later.
- [ ] Implement; tsc/lint/test green.

### Task 5: History page UI

**Files:** Modify `CategoryFilter.tsx`, `ChannelFilter.tsx`, `feed-filters.ts` (`feedHref(f, basePath = "/")`),
`CardActions.tsx` (+`canRemoveFromHistory`), `VideoCard.tsx` (+`onHistory`), `history/page.tsx`; Test `tests/lib/feed-filters.test.ts`.
- [ ] Test `feedHref uses the base path` (`feedHref({categoryIds:[1],channelIds:[]}, "/history")` → `"/history?categoria=1"`,
  empty → `"/history"`). Run → FAIL. Implement. Run → PASS.
- [ ] Implement UI; tsc/lint/test green.

### Task 6: Review and browser check
- [ ] Fresh reviewer on the diff; fix Critical/Important; browser check (needs the user signed in in the pane).
