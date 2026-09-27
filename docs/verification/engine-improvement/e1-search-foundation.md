# E1 inactive search foundation

28 September 2026 BDT. Local development only; no opponent dispatch or rating changed.

`src/engine/next/search.ts` implements `next-neutral-v1`. A complete two-ply comparison precedes
bounded forcing refinements. An incomplete baseline returns no move; interrupted refinements retain
the entire last completed comparison. Scores use White's perspective, identify completed depth and
leaf policy, and expose exact alternatives only after a full common-depth comparison.

## Evidence

- Initial missing-module test failed, then the first five behavioral tests passed.
- Expanded boundary checks exposed negative-zero draw output; canonical zero fixed that failure.
- Final `npx vitest run tests/engine/next-search.test.ts`: **15/15 passed**.
- `npm run typecheck`: passed, frontend and server.
- Both colors at depths two and three match an independently implemented exhaustive reference
  without pruning, shared repetition state, ordering or production search calls.
- Tests cover the exact reported F01 queen capture, the opponent's immediate mating reply, legal
  forced defense, losing positions, root/descendant repetition, sibling restoration, terminal
  precedence, forcing-cap interruption, final publication expiry and completed-result retention.
- Independent algorithm/TypeScript review accepted the inactive correctness foundation with no
  blocking finding. The reviewer inspected the new tests but did not independently rerun them.

## Limits and next gates

This is not yet a production engine or a strength improvement. No current worker imports it.
Pre-search history processing is bounded but not cancellable; profile its cost before integration.
Future configurations must freeze all reported search settings. E2 will profile and compare any
optimization against this reference before timed strength trials. Worker recovery, actual-device
timing, new opponent identities and application personality experiments remain outstanding.
