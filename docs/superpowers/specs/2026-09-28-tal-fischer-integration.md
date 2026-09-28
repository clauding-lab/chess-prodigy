# Local Tal/Fischer experiment integration — 28 September 2026 BDT

Continues the approved27September master plan and engine design, explicitly invoked again by the
owner with “do it” after the28September implementation outline. Local implementation, not release.
Strength and recognizable coherent personality remain equal acceptance criteria. Existing measured
opponents and receipts stay exact. No paid service, Stockfish, other master, or live-player data.

## Identity and authority

Tal/version2/tal-coherent-v1 and Fischer/version2/fischer-coherent-v1 retain seeded-per-ply-v1 with
explicit32bit seeds. They are always unrated; neither rating lookup nor server settlement may borrow
version1 ratings. Preserve old rematches exactly. New experimental setup requires
VITE_ENGINE_EXPERIMENT=true as well as the existing historical-personality flag, both defaultoff.
Supported saved version2 games remain recoverable with either flagoff. UI explicitly labels an
experimental unrated game and keeps the existing Home/resume-or-forfeit flow.

Advance local guest/account authority to v9 and guest-history to v8. Read the current v8/v8/historyv7
as the newest recovery predecessors before all older generations, never modifying them. Wire remains
compact3; accepting an experimental game permanently raises account minimum client policy7, including
assisted games, and reset cannot lower it. Preserve exact attempted old envelopes and acknowledgements.
Unknown policies/versions fail closed; no substitution with a current opponent.

## Calculation and decisions

Extract reusable request/cancel/watchdog transport from the reviewed next-worker client without
changing its original protocol. Add a separate historical-experiment worker contract: request carries
opponent identity, game/revision, root, legally replayed prior FENs, ply and difficulty. Result records
book, complete neutral/plan, terminal or incomplete as distinct outcomes. New workers alone import
new policy code. Preserve documented legal continuation counts and weighted selection exactly.
Terminal/draw checks precede any book lookup.
New experimental game settlement and compact replay use the same v2bishop-only dead-position rule
as their engine; earlier opponent identities retain their original insufficient-material rule.

Off-book: next-neutral-shortlist-reuse-v1 supplies complete comparable evidence, with30ms reserved
for bounded plan ranking within total200/600/2000ms. Only exact candidates inside a declared loss
window qualify; bounds cannot rank choices. Tal100cp/Fischer50cp are development limits, not ratings
or sacrifice guarantees. Mate/forced-move outcomes use neutral best. Unfinished baseline returns
incomplete with no move. Ranking expiry returns the last completed neutral best, never a partial
personality ranking. Include ranking and history handling in measurements; report worker startup
separately. Do not claim measured strength from the earlier search-only profiles.

A plan is reconstructed deterministically from legal prior positions, avoiding a new mutable plan
field. Retain a viable recent plan for at most6own turns; change it when the target disappears, the
phase changes, or safety requires. Tal builds king-zone coordination and pawn breaks before forcing
pressure. Fischer develops less-active pieces, targets open files/weak pawns and converts a lasting
advantage with safe exchanges/passed-pawn support. Both retain mandatory defensive exceptions. These
are designed priorities, not recovered historical thought. Do not merely change old bonus weights.
Positive and negative multi-move fixtures must demonstrate persistence and abandonment for both colors.

## Application recovery

useGame routes only exact new identities through the new worker. Supersession, account changes and unmount cancel both routes. Home pauses untimed work;
started timed games continue their original calculation/reply deadline on Home, preserving the
existing owner-approved timing rule. An incomplete or failed request preserves position,
marks engine-interruption provenance, and presents Retry. No move or rating receipt comes from an
incomplete result. Timed settlement remains authoritative, with existing interrupted-timeout rules;
future successful retry cannot erase earlier interruption provenance. Preserve minimum reply timing.
Book/plan rationale derives from decision metadata; no invented thought or evaluation from a book move.

## Acceptance sequence

1. Version/rating and migration regressions, policy7 persistence and old raw acknowledgements.
2. Policy tests: legal weighted books, terminal precedence, deadline/incomplete, exact-only selection,
   reproducible seeds, both-color multi-turn positive/negative plans and forced defense.
3. Hook and actual-browser tests for start, move, interruption/retry, cancellation, save/reload,
   Home, result/rematch and flagoff recovery. Rebuild bothflags and verify all emitted workers offline.
4. Preregister complete-game development/untouched-validation strength schedules and paired-bootstrap
   analysis before personality tuning; freeze candidate sources before matches. Preserve all outcomes.
5. Complete-game strength, independent tactical/held-out assessment, real-phone and12pair blind owner
   comparison. No expansion to other masters or rated activation unless both main gates pass.

Any failed experiment is retained and labelled failed. This contract does not claim that all preceding
E2 gates have passed; it permits local actual-app evidence collection for the first two candidates.
