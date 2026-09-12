# Task 3 integration report — 12 September 2026 BDT

Completed at 22:08 BDT from Task 2 baseline `baceb0d`.

## Result

Integrated the accepted version 4 `attack-development/plans-v1` opponent into the actual app as the current rated Paul Morphy configuration. Fresh Morphy games now use version 4; explicit rematches retain versions 1, 2 or 3. The accepted fixed Practice Ratings are Casual 1225, Club 1400 and Strong 1625. Existing version 2 values 1200/1375/1825 and version 3 values 1275/1375/1775 remain unchanged.

The Home and setup copy now describes recorded openings plus designed development, central-break and king-attack plans. Version 3 rematches retain the earlier recorded-moves and learned-preferences explanation. There remains one visible Paul Morphy choice.

## Compatibility and account fence

- Current guest/account/history keys advanced to state-v5, account-v5 and guest-history-v4.
- Ordered recovery now includes former current state-v4, account-v4 and guest-history-v3 before older generations.
- Migration keeps older bytes intact, durably copies pending account queues with their base version and preserves null-only fallback: a corrupt current generation blocks older fallback.
- The account client sends `X-Chess-Rating-Policy: 3`.
- The server accepts only literal policies 1, 2 and 3. Any accepted version 4 snapshot, including an assisted one, atomically raises that owner’s permanent minimum to 3. Classic games, rating reset and server restart retain the floor. Conflicting, malformed and future-policy requests neither write nor raise it.
- The server still stores `JSON.stringify(body.snapshot)` and returns the original wire snapshot exactly; derived review normalization remains client-side.

## Tests and checks

TDD red run: 9 expected failures across rating eligibility/receipts, setup mapping, three storage generations, account pending migration and the server policy floor. After the minimal implementation:

- Focused Vitest: 6 files, 71 tests passed.
- Full `npm test`: 46 files, 426 tests passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- `npm run format:check`: passed.
- `npm run build`: passed, including PWA service-worker generation.
- `git diff --check`: passed.

Browser fixtures that exercise the current key now use state-v5. The retained actual-app journeys cover fresh version 4 guest play/resume, accepted UI copy and ratings, explicit version 3 rematch preservation, and signed-in version 4 completion/sync with policy-3 rejection of older clients. The controller owns the final full enabled/default browser runs.

## Frozen-source preservation

Compared the working bytes against `d8c376d`. All ten playing-policy inputs remain byte-identical:

- `src/engine/morphy-plans.ts` — `7802da82eb756cdf28c55e70f67e13695d66831a7b8be323c4ca900f509f047d`
- `src/engine/search.ts` — `8492c5e56d6d756f5a61084b2a74e7c8cffeeedd686f2ef4324fce6f73ddcf43`
- `src/engine/morphy.ts` — `7eccc12b971bd0d181668f15729a11401afe2ce077e7917c0286ccb3284bbd67`
- `src/engine/historical-morphy.ts` — `e11ab939cfaa65a93f6a79fd415dcef0941c2ded6ce5876266a75cf0fd256d33`
- `src/engine/historical-features.ts` — `1be6bdd493f0fe7a448f747b15119643f43aeb6b111a7caf443db60cf4328b03`
- `src/engine/eval.ts` — `5f4b90319c7727dbc73dcaa9e50a735eb90c04a1a42a07ab4f1fd4fe65431b6f`
- `src/engine/board.ts` — `48549435f7a6f68abb5f787fb9003cbfb542992d0c5737c72dcd17a3ca0637ef`
- `src/book/morphy-book.json` — `c5230029b96e9a56198d160e03dadee61e7a91d65f77af8b429823ee47049e94`
- `src/engine/morphy-model.json` — `bcac472c15613f704ec1069c2089951312321a6f43ff2e33f0c50d69621cefc3`
- `src/book/morphy-games.json` — `77a770ddbc030b2684521624284ca36eb5afee7dc239beb44bc20561cd766a07`

The only change in `src/engine/opponents.ts` is rated eligibility for already-supported exact version 4 configurations. No engine decision body, harness, calibration artifact or prior rating table changed.

## Scope

Task 3 changed 35 owned source/test files (321 insertions, 143 deletions, chiefly current-key fixture replacements) plus this report. Controller-owned release documents and package metadata were left unstaged. No push, deployment, tag, release or live-player data action was performed.
