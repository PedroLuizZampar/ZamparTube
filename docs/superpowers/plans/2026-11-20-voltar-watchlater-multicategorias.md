# Voltar, "Assistir depois" editável e várias categorias por canal — Implementation Plan

> Pedido do usuário (2026-11-20): "Monte o plano e já implemente, não precisa da minha aprovação".
> Execução inline (superpowers:executing-plans). Sem commits até o usuário pedir.

**Goal:** Back buttons on playlist and channel pages; player without YouTube chrome and with a hidden volume thumb;
Watch Later renamable (name used everywhere) and with an image; channels in several categories, edited as tags with
thumbnails.

## Decisions

- **Voltar**: client `BackButton({ fallbackHref, label })` — `router.back()` when the app has history
  (`history.length > 1`), else `router.push(fallbackHref)`. Playlist page → `/playlists`, channel page → `/channels`.
- **Player chrome**: the YouTube frame is 72 px taller than the player on each side and centred, so its title bar and
  logo fall outside and are clipped (the video keeps its size because it is width-bound). Volume slider fully invisible
  (`invisible opacity-0 w-0`) until hover/focus.
- **Watch Later**: `renamePlaylist` allows it (still unique, still undeletable). The name reaches client components
  through `WatchLaterNameProvider` (set in `(app)/layout.tsx` from `getWatchLaterName(db)`); copy uses it:
  card actions "Salvar em “X”" / "Remover de “X”", watch page button shows "X" (saved: ✓ + "X"), empty-playlist hint.
  Grid card and playlist header get the pencil (name + image) but never the trash.
- **Multiple categories**: new table `channel_categories (channel_id → channels cascade, category_id → categories
  cascade, PK both)`; migration copies `channels.category_id` and drops the column.
  - `ChannelListItem.categoryIds: number[]`; `setChannelInCategory(db, channelId, categoryId, on)`;
    `setChannelCategories(db, channelId, ids)` (no transactions: Neon HTTP has none).
  - Filters: a channel matches a category filter if it has any selected category (`videos.channel_id in (select … from
    channel_categories where category_id in …)`); `ChannelRef = { id, categoryIds: number[] }` in feed-filters.
  - `CategoryItem.channelCount` counts active channels through the join table.
  - UI: `CategoryTags` (chips with 20 px round image or initial, × to remove, "+ Categoria" menu with checkbox items
    and thumbnails, link to /categories when none exist) on each channel row and in "Adicionar canal" (hidden input
    `categoryIds`, comma-separated).

## Tasks

1. Back buttons (UI).
2. Watch Later rename + provider + copy + image (TDD on `renamePlaylist`).
3. Multi-category schema, queries, filters (TDD), migration.
4. Category tags UI on channels.
5. Fresh review of the round, fixes, browser check.
