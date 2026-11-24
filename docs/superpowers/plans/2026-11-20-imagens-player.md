# Imagens, categorias em cards, filtro instantâneo e reprodutor próprio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Category cards with images, playlist images and delete shortcut, instant channel filter, custom player controls,
and the deferred review minors.

**Architecture:** Images stored in the DB like channel avatars and served by route handlers; client resizes before upload.
Player keeps the YouTube IFrame API as the video surface and renders its own controls layer.

**Tech Stack:** Next.js 16.4.6, React 19.3, Drizzle, PGlite tests, Radix, Tailwind 4, lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-20-imagens-player-design.md`

## Global Constraints

- pt-BR copy as in the spec. No commits unless asked. `npm test`, `npx tsc --noEmit`, `npm run lint` green per task.
- Images: accepted `image/jpeg|png|webp`; stored payload ≤ 300 KB after client resize; server rejects anything else.
- Migration via `DATABASE_URL=postgresql://x@localhost/x npx drizzle-kit generate`, hand-edited dedup; `npm run db:dev`
  only with the dev server stopped.

## Review Focus

1. Uploading a non-image or oversized file → friendly error, nothing stored.
2. Image URL changes after replacing an image (cache-busting `?v=`).
3. Player: keyboard shortcuts must not fire while typing in an input elsewhere on the page.
4. Player: progress still saved on pause, tab hide and leaving the page; ended → end screen + watched.
5. Channel menu stays open while each toggle navigates.

---

### Task 1: Category queries + image columns (TDD)
**Files:** `src/lib/db/schema.ts`, `src/lib/queries/channels.ts`, `src/lib/queries/images.ts` (new),
`src/lib/queries/playlists.ts`, `drizzle/0004_*.sql`, tests `tests/lib/queries/{channels,images,playlists}.test.ts`.
**Produces:**
- `CategoryNameTakenError`; `createCategory(db, name?)` (default "Nova categoria", "Nova categoria 2"…; case-insensitive
  unique); `renameCategory` throws `CategoryNameTakenError` (own case change allowed).
- `listCategories(db): Promise<CategoryItem[]>` with `{ id, name, imageSrc: string, channelCount: number }`
  (`imageSrc` = `/category-image/<id>?v=<ms>` or `""`; `channelCount` counts active channels).
- `PlaylistSummary.imageSrc: string` (`/playlist-image/<id>?v=<ms>` or `""`).
- `setImage(db, kind: "category" | "playlist", id, img: { data: string; contentType: string } | null)`,
  `getImage(db, kind, id): Promise<{ data: string; contentType: string } | null>`.
- Columns on both tables: `image_data text`, `image_content_type text`, `image_updated_at timestamptz`;
  categories unique index `categories_name_lower_unique` on `lower(name)` (replaces case-sensitive unique).
- Translate PG `23505` into the NameTaken errors in create/rename for both playlists and categories.
- [ ] Tests first (default names; case-insensitive duplicate; own case change; channelCount; imageSrc set/cleared and
  `v` changes; getImage round trip). RED → implement → GREEN.

### Task 2: Image routes, upload actions, client resize
**Files:** `src/app/category-image/[id]/route.ts`, `src/app/playlist-image/[id]/route.ts`, `src/lib/images.ts`
(`parseImageUpload(file: File): Promise<{ data; contentType } | { error: string }>`), actions
`setCategoryImageAction(id, form)`, `setPlaylistImageAction(id, form)` (`form` has `image` File or `remove=1`),
`src/lib/client/resize-image.ts` (`resizeImage(file, { width, height }): Promise<Blob>` cover-crop via canvas).
- [ ] Test `parseImageUpload` (rejects text/plain, rejects > 300 KB, accepts small PNG) RED → GREEN; routes 404 without image.

### Task 3: Categories page cards + playlist cards (UI)
- Categories: `CreateCategoryButton` → `/categories?editar=id`; `CategoryCard` (image or Tags icon, name, "N canais",
  pencil, trash w/ ConfirmDialog); `CategoryEditor` (name + image chooser/removal). Playlists: trash on cards (not WL),
  `PlaylistNameEditor` gains image controls; cover = `imageSrc || coverThumbnailUrl`.
- Shared `ImagePicker` client component (`kind`, `id`, `hasImage`, `aspect`).

### Task 4: Filters
- Chips show 18px round image when `imageSrc`; `ChannelFilter` navigates on each toggle (`router.replace`, `scroll:false`)
  and keeps the menu open; trigger accessible name includes the selection.

### Task 5: Custom player
- Rewrite `src/components/Player.tsx` into `Player.tsx` (YT wiring + state) and `PlayerControls.tsx` (UI). Poll
  `getCurrentTime`/`getVideoLoadedFraction` every 250 ms while playing. Keyboard handler on the player container + window
  (ignored when focus is in input/textarea/select/contenteditable).

### Task 6: Review minors (list in spec §6)

### Task 7: Final review + browser check
