# Decisões tomadas durante a construção

Registro das decisões que tomei sem te perguntar e das melhorias menores adiadas, extraído do controle de progresso da implementação (2026-11-03). Cada linha diz o que foi decidido, por quê e quanto custa se estiver errado.

## Decisões

- Setup: Ruling: no worktree; fresh repo initialised with docs on main, work on branch feat/zampartube-v1 — empty project, nothing to isolate from — cost if wrong: none.
- Setup: Ruling: review cadence chosen by user: inline execution + review after Task 5, review after Task 9, final whole-branch review after Task 11 — user instruction — cost if wrong: n/a.
- Setup: Ruling: Task 12 (deploy) needs user's Neon/Vercel; stop after final review and hand Task 12's user steps over — cost if wrong: none.
- - T6 saveProgress consumes shouldMarkWatched (T9 Produces) → Ruling: create src/lib/player/progress.ts with shouldMarkWatched+resumeFrom in T6; T9 adds tests/uses. Cost if wrong: none.
- Task 1: Ruling: disabled cacheComponents/partialPrefetching from Next 16 template — fully dynamic single-user app, avoids Suspense rules around cookies/DB — cost if wrong: slightly slower navigations.
- Task 1: Ruling: @types/node bumped to ^24 — vitest 5 peer conflict with ^20; Node 24 is installed — cost if wrong: none.
- Task 1: Ruling: scaffolded in scratchpad and copied (create-next-app refuses non-empty dir); AGENTS.md from Next kept — cost if wrong: none.
- Task 2: Ruling: neon-http driver instead of neon-serverless Pool — no interactive transactions needed, simpler on serverless — cost if wrong: swap driver in client.ts.
- Task 2: Ruling: stemming test uses 'programar' (Postgres portuguese snowball keeps 'linguagens' unstemmed) — real Postgres behavior — cost if wrong: none.
- Task 5: Ruling: dropped test 'only calls channels/playlistItems/videos endpoints' — YouTubeClient interface has no search method, so the type system enforces it — cost if wrong: none.
- Task 5: Ruling: runSync always syncs at least one channel before checking the budget — guarantees progress per call — cost if wrong: one channel may overrun the budget.
- Task 5: Ruling: UULV errors other than quota are ignored (spec: 'não existir ou der erro' → seguir) — cost if wrong: lives silently missing on a broken playlist.
- Task 6: Ruling: src/lib/player/progress.ts (shouldMarkWatched, resumeFrom) created in Task 6 since saveProgress needs it; tests come in Task 9 — cost if wrong: none.
- Task 6: Ruling: 'never appears' test verified by temporarily allowing shortsCheck 'pending' in visibility (RED) then restoring (GREEN), since the implementation predated activation — cost if wrong: none.
- Task 7: Ruling: src/proxy.ts (Next 16 renamed middleware → proxy) — framework change — cost if wrong: none.
- Task 7: Ruling: checkPassword is a pure-JS constant-time compare (no node:crypto) so it runs in any runtime; empty expected password never matches — cost if wrong: none.
- Task 7: Ruling: added src/components/Logo.tsx now (login page needs it; Task 8 reuses) — cost if wrong: none.
- Review1: Ruling: re-graded minor "malformed % throws" to Important (unhandled exception on user input) and fixed — test RED→GREEN.
- Review1: Ruling: re-graded minor "2xx non-JSON read as empty" to Important (with the new re-check it would delete videos) and fixed — test RED→GREEN.
- Review1: Ruling: worst-case single channel (first import + 50 probes) can exceed maxDuration 60 — kept 60s (Hobby-safe); runSync budget + backfill spread work across runs — cost if wrong: an occasional timed-out cron run, retried next day / via "Atualizar agora".
- Task 8: Ruling: dev-only DATABASE_URL=pglite:<dir> mode in getDb + scripts/dev-db.mjs, to verify UI locally without the user's Neon — cost if wrong: PGlite package bundled as server external (unused in prod).
- Task 8: Ruling: .env.local (gitignored) created with the API key the user pasted in chat + generated dev secrets, to verify against the real YouTube API — user's own key for this app — cost if wrong: user may prefer rotating the key (already advised).
- Task 8: Ruling: impeccable init interview skipped — aesthetic pinned in the approved spec and user only validates the final result; craft floor applied, detector clean — cost if wrong: none.
- Task 8: Ruling: lucide-react for icons; thumbnails via next/image unoptimized (avoid Vercel image-optimization quota) — cost if wrong: heavier maxres thumbnails.
- Task 8: Ruling: added src/lib/format.ts (duration/relative date) and src/lib/sync/messages.ts with tests — needed by UI — cost if wrong: none.
- Task 9: Ruling: player gets width/height 100% via YT.Player options (iframe ignored the CSS) — cost if wrong: none.
- Task 9: Ruling: video descriptions rendered as plain text (no linkified URLs) — fewer exits to outside content, matches anti-goals — cost if wrong: user can't click links in descriptions.
- Task 9: Ruling: EndScreen adds "Assistir de novo" — cost if wrong: none.
- Task 10: Ruling: added getPlaylist() (pages need name/isWatchLater) and getWatchLaterId self-heals if the seed row is missing — cost if wrong: none.
- Task 10: Ruling: playlist summary counts only visible videos — consistent with the visibility rule — cost if wrong: none.
- Review2: Ruling: re-graded minor #3 (no session check inside server actions) to Important (security, defence in depth per Next 16 docs) — requireSession() in every action; not unit-tested (needs request cookies).
- Review2: Ruling: re-graded minor #4 (no pt-BR error/404 pages; createSyncDeps outside try) to Important (violates pt-BR constraint) — added app/not-found.tsx + (app)/error.tsx; verified 404 page in browser.
- Review2: Ruling: re-graded minor #5 (no player error fallback) to Important (black/YouTube error box with no way out) — onError + script onerror show "Abrir no YouTube".
- Review2: Ruling: re-graded minor #7 (stale watched state after video ends) to Important — router.refresh() after the end save.
- Review2: Ruling: re-graded minor #8 ("Carregar mais" dead past 500) to Important (Fireship has 812 videos) — cap 2000 + button hidden at cap — tests/lib/paging.test.ts.
- Review2: Ruling: re-graded minors #9 (overlapping badges) and #10 (dismiss hidden on touch tablets) to Important (visual bug / unreachable control) — fixed, hover-only hiding via @media(hover:hover).
- Task 12: Ruling: README written before the final review (needs no user input); deploy steps 2–4 wait for the user's Neon/Vercel — production build passes (Turbopack).

## Melhorias menores adiadas

- Review1: minor (deferred): UULF non-404 4xx errors don't fall back to UU per run.
- Review1: minor (deferred): >20 new pages between syncs silently skips the rest (log only).
- Review1: minor (deferred): UULV item with 'none' and no actualEndTime (cancelled stream) treated as regular video.
- Review1: minor (deferred): probe canary for YouTube redirecting all /shorts/ to /watch; check v= equals id; cancel response body.
- Review1: minor (deferred): rateLimitExceeded/userRateLimitExceeded not treated as stop conditions.
- Review2: minor (deferred): pagehide/visibilitychange saves may be dropped on tab close (10s interval bounds loss).
- Review2: minor (deferred): PGlite imported unconditionally in db client (only used with an explicit pglite: URL).
- Review2: minor (deferred): duplicate getVisibleVideo in generateMetadata + page (wrap in React cache()).
- Final: minor (deferred): saveProgressAction never revalidates, so Back can show a 90%-watched video in the feed until refresh.
- Final: minor (deferred): error.tsx "Sessão expirada" branch never matches in production (messages are redacted) — falls back to generic message with working links.
- Final: minor (deferred): playlist videos of removed channels are never re-checked for deletion (player onError covers playback).
