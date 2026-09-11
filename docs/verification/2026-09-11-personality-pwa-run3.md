# Personality PWA — Run 3 verification

11 September 2026 BDT. Handoff revision 2; plan `docs/plans/2026-09-11-personality-pwa-run3.md`.
Checkout `/Users/adnanrashid/Projects/chess-prodigy`, branch `codex/personality-pwa-run3`,
base `32c023d21229a07f6ab4f88f67f4f73a037b6d97`; initial changes empty.
Both records written before application/test/config/schema changes. No path-convention deviation.

Fresh baseline passed: npm test (285 / 33 files), typecheck, lint, format:check, build,
full browser (74 passed, four existing skips), accessibility (wood/dark 100); all exit 0.
Node 22.23.0. The skips are three duplicate mobile account cases and desktop touch-only audio.
Logs `/tmp/chess-prodigy-run3/`. Prior 285/74 Chrome and ten origin-outage passes are historical,
not newly executed evidence. WebKit offline simulation remains a characterized tool limitation;
physical iPhone installation/sound/performance/lifecycle verification remains pending.

R3.0 complete; R3.1–3 implementation not started. No release or live-data
actions. Next: implement shared archive and guest persistence with failing regressions.

## R3.1 — archive/guest foundation

Implemented shared compact records (optional time metadata), legal replay, 200-game retention,
idempotent upsert/remove and comparable configuration/difficulty rivalry with assistance partitions.
Guest archive key is `chess-prodigy-guest-history-v1`, outside active Session v2. Archive-first writes
reconcile on reopening from the authoritative active save, including interrupted undo. Corrupt,
unknown-version, oversized and quota-blocked history never overwrites existing history bytes.
New-game replacement now stops if the prior terminal cannot be preserved; the result remains in memory.

Red-first module tests and a failing live-hook terminal-handoff regression preceded implementation.
First focused suite passed 108 tests. Independent reviewers found generated archive output could
violate its own bounds, and time validation allowed an array through string coercion. Both reproduced
and fixed: validate before guest/server writes, require primitive time string; metadata limits align
with the existing 256 KiB wire ceiling rather than invalidating formerly valid 257-character IDs.
A legal 501-ply regression preserves the complete active save and prior history while reporting the
500-ply archive limit. This is a recoverable archive failure, not a truncated or silently lost game.

Two additional red-first findings: untimed resignation/abandonment used the previous move timestamp,
and assisted Classic abandonment was omitted. New completions now record actual completion time;
assisted abandonment remains unrated and retains unchanged rating. Historic timestamps are untouched.
Both reviewers approved the fixes; final focused suite **112 tests / 13 files passed**, and
typecheck/lint/format all exit 0 (`r31-final-*.log`). No SQL migration. R3.1 eligible for local commit;
next: account cached history with pending overlay and owner-scoped adapter integration.
