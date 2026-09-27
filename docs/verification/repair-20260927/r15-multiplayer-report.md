# R15 multiplayer summaries — 27 September 2026 BDT

Local implementation and synthetic evidence; no live data, publication or deployment.

## Changes

- Added authenticated `/api/multiplayer/summaries` before the game-detail route. New lobby and H2H callers use it; account ratings use the smaller authenticated `/rating` endpoint. The existing full-list endpoint is retained unchanged for older clients. Single-game detail remains complete and participant-only.
- Summaries contain current participant names/ratings, turn, status, result and identifiers/timestamps. They contain no board, moves, coaching review or raw saved state.
- Added disposable `mp_summaries` and indexed per-participant membership projections. Creation/join/action writes refresh them inside the existing transaction, including rating/H2H completion. Projection failure rolls back the whole mutation.
- Startup backfill uses 50-row keyset batches and transactions, validates through the existing multiplayer normalizer, bounds source strings before materializing them, and leaves original state unchanged. Invalid states receive a fixed diagnostic in private `mp_summary_quarantine`; database failures propagate rather than being disguised as invalid data. Repairing a quarantined row requires deliberate projection regeneration/removal of its quarantine marker, or a valid normal game mutation.
- Polling reads only compact projections. Each of three indexed status groups reads at most 200 projections; the merged response contains at most 200 games, with expired invitations ranked after live games. Invitation creation retains the existing 30-open-game limit.
- Lifetime H2H counts remain in `mp_pairs`; keyset pagination fetches at most 51 pairs and returns 50, with an opaque opponent-ID continuation. Both H2H modal and lobby have ordinary keyboard-accessible Load more opponents buttons. Delayed account responses are discarded. Lobby polling preserves already expanded pages; those later-page totals refresh on reopening the lobby.

## Evidence

Initial compact-summary regression failed with 404 before implementation.

Latest focused run: 31 tests passed across multiplayer server, H2H hook and invitation-navigation suites. Type checking and repository lint passed. An earlier complete server-suite run passed 93 tests; the focused suite subsequently gained the projection-failure rollback test (26 multiplayer server tests now).

New regressions cover:

- complete detail/legacy responses, compact summary exclusion, participant isolation and exact rating-only response;
- 1,201 projected synthetic games plus a corrupt row, bounded 200-game payload below 200 KB, query-plan use of the membership ordering index without a temporary sort;
- renaming the authoritative raw game table after projection build while summary polling still succeeds, proving no request-time raw-history reads;
- source-byte preservation during backfill and private fixed corruption diagnostics;
- 123 opponents across 50/50/23 pages with unchanged 1,100-game lifetime totals and unrelated-account exclusion;
- delayed H2H pages after account switching and page append without changing lifetime counts;
- injected projection-write failure rolling back game, ratings and pair totals, followed by exactly-once successful retry;
- old expired invitations not displacing a recent completed game.

A pre-existing threefold test used locale-aware JavaScript sorting to compare SQLite binary ordering of random account IDs; corrected the test comparator after reproducing the intermittent mismatch. Production draw rules are unchanged.

## Review and remaining gates

Independent review and actual-browser UI verification are still required. Native button semantics and existing modal handling are retained; no new physical-device or screen-reader claim is made. The legacy compatibility full-list endpoint intentionally retains its previous heavier response; new clients no longer use it. Chess playing policies, Elo mathematics and raw legacy game states were not changed.
