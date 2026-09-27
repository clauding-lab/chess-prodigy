# R11 coaching repair — 27 September 2026 BDT

Local implementation; no commit, push, deployment or live data access. Independent root review remains required.

## Contract

`custom-neutral-v2` / `review-v2` replaces old neutral review identities. Each result carries root FEN (including clocks/rule state), the existing full-history fingerprint, White score perspective, completed depth, completion status, and an exact score for every legal root alternative. `searchRootCandidates` already commits only a completed iteration and clears the transposition table for each alternative; this repair does not change that frozen playing/search source. A timeout can retain the last fully completed common depth; no completed iteration means no grade. Hint work also uses the new reviewer identity and root comparison, retaining its separately identified hint budget.

Annotation now compares best and played alternatives from that one root. It never subtracts the separate position display scores or requires an unrelated after-position result. Missing, duplicate, illegal, non-finite, wrong-perspective, wrong-root/history, obsolete-version/policy, or incomplete comparisons cannot grade. Existing storage projection uses `isNeutralEvaluation`, so prior cache generations are invalidated/recomputed while exact raw wire acknowledgements remain untouched.

Opening membership remains on the history entry as provenance; it no longer suppresses a neutral grade. Coaching UI explicitly distinguishes coaching openings and documented-master moves from move quality. All 185 opening records and all 27 protected motif cards/prose are unchanged.

Motif detection checks an actually opened ray after a retreat, excludes pawn promotions from piece-sacrifice detection, checks usable captures rather than pinned geometric attackers for material threats, detects increases in the mover's doubled-pawn count, and requires a nearby own-pawn barrier for back-rank mate. The approved doubled-pawn trigger uses existing factual detail wording (`White's pawns are doubled.` / `Black's pawns are doubled.`), requiring no protected prose edit. Geometric check attacks remain distinct from legal material captures.

## RED / GREEN evidence

- New root-only regression initially failed (`null` rather than an assessed sound move). It passes with full legal alternatives and explicit perspective/completion.
- Motif regressions exposed promotion-sacrifice, pinned-sacrifice, doubled-pawn and pawnless edge-mate errors; the retreat fixture was corrected to a legal queen retreat along a bishop ray before validation. Positive and negative pairs now pass, including doubled count 2→1 and 1→2. Original 12 supplied fixtures and verbatim 27-card comparison still pass.
- Curated Ruy Lopez opening line at deterministic depth 3: old unmatched before/after losses for e4/e5/Nf3/Nc6/Bb5 were 60/60/50/40/50 centipawns; new same-root losses are 10/10/0/0/20, with no mistake grades. The next documented coaching-book continuation a6 remains a 140-centipawn estimate and `?`; theory is not used as a circular correctness oracle. Real free-queen blunders still receive `??` for both colors.
- Tests explicitly reject old reviewer/policy identities, missing/duplicate/illegal/non-finite alternatives, wrong perspective, incomplete/depth-zero arrays, and mismatched history/rule state. Tests verify separate display-score changes cannot alter a root grade, stale async reanalysis remains rejected, and fresh complete root results replace cached grades.
- Focused Node 22.23.0 run: 10 files / 140 tests passed (coach, reviewer, Morphy, worker, game hook, storage and CoachPanel). Two additional doubled-count cases subsequently passed (motif suite 58/58). Earlier full UI selection: 15 UI files passed; hook fixture expectations required updating from obsolete injected before/after scores to explicit root alternatives and then all 26 hook tests passed.
- `npm run typecheck` and scoped ESLint passed. Changed files formatted with Prettier.
- An initial test invocation used the shell's newer default Node and failed hook setup because its experimental localStorage was unavailable; the correct `.nvmrc` Node 22 rerun is the evidence above.

## Source ownership

Changed production files: `src/engine/reviewer.ts`, `src/coach/{annotate,motifs,types}.ts`, `src/ui/{CoachPanel,Modals}.tsx`; coordinated policy-only substitutions in `src/game/useGame.ts` and `src/multiplayer/Review.tsx`. Worker request/result types inherit the versioned reviewer types without a protocol-file edit.

Tests: `tests/coach/{annotate,motifs,review-root}.test.ts`, `tests/engine/{reviewer,morphy}.test.ts`, `tests/game/useGame.test.tsx`, `tests/storage/{long-game.ts,store.test.ts}`, `tests/worker/client.test.ts`. Storage/Morphy/worker fixture edits outside the core new regressions are policy-literal updates only.

## Limits

This remains a bounded custom-engine estimate. A fully completed shallow depth is comparable, not proof of perfect chess; early timeout can reduce its completed depth. The unchanged underlying search is not newly claimed to solve every draw/history/search limitation. No perceived historical style, deeper strength improvement, physical-device speed, browser/offline completion, or release is claimed by these tests. The new derived arrays can be larger than old review caches; root owns the compact-authority activation which omits derived caches. No historical playing policies, books, seeds, fixed ratings or receipts changed.

## Independent-review correction — 27 September 2026 BDT

Reviewer identified that coordinate-only `sameMove` accepted forged special flags. RED: four new cases (ordinary knight move forged with queenside castle, en passant, queen capture, or double-pawn flag) were accepted and retained an illegal suggestion. GREEN: reviewer boundary now compares every move attribute with canonical legal moves for both root alternatives and `best`/hint moves. The shared frozen `sameMove` and playing engine remain unchanged. Rejected comparisons clear both grade and suggestion before SAN/application. Genuine castling and en-passant results remain accepted.

Final isolated root/reviewer selection: 15/15 tests passed, including all four forged flags and both canonical special moves. Typecheck, scoped lint and diff check passed. Focused broader rerun was 144/146; the two failures are concurrent compact-writer integration assertions that read old raw `.game.hist` paths in `useGame.test.tsx` (lines 256 and 407 at run time). The in-memory reanalysis assertion passes. Root was notified to adapt those persistence assertions to its new authority representation; this correction did not modify that work or its tests. No commit or publication performed.
