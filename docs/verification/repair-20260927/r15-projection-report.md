# R15 — public query foundation

27 September 2026 BDT. Local candidate only.

Practice leaderboard reads now use `player_rating_projection`, with a partial ranking index and a
100-row limit. Validated rating/count updates share the records transaction; resets remove a player
from ranked results. A two-second cache is invalidated by writes. Names remain current within that
cache window; emails, IDs and private histories are excluded.

Startup backfill uses keyset batches of 16. Invalid snapshots retain their original bytes and receive
an account/version diagnostic in `record_projection_errors`; repeated startup skips the same rejected
version. Generated disposable data verified 500 valid accounts plus one corrupt record, repeated
backfill, indexed ordering, and transaction rollback. Public reads still work when the private
snapshot is deliberately replaced with invalid JSON after projection.

Both public boards share per-address (60/minute) and application (6,000/minute) limits. Rejected
traffic consumes neither another visitor's quota nor new map entries; the global cap bounds memory.
Forwarded identities require explicit local-tunnel configuration and a valid single IP. Default is
to ignore forwarded headers. Deployment configuration and shared-IP limits are documented in the
runbook; production has not been changed.

Tests: missing module RED, then projection iterator/write conflict reproduced and corrected with
bounded batches; final `public-limit.test.ts` + `leaderboard-projection.test.ts`: 4/4 pass. Account
load integration plus projection: 12/12 pass. Typecheck passed. Security review independently ran
4/4 and found no actionable issues. General/TypeScript review recorded separately before commit.

R15 multiplayer summary/detail work remains separate and is not claimed complete here.
