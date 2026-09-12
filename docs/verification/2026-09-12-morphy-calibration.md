# Morphy calibration and rated play — 12 September 2026 BDT

Owner approved measuring the existing Morphy engine and making future games affect the existing Practice Rating, then updating the live site. Base: d0ef938; branch: codex/morphy-calibration-rated. Existing beta games stay unrated, Classic and 1v1 mathematics stay unchanged. Hosted Morphy beta was enabled earlier today at immutable v2.0.0.

## Protocol fixed before results

Measure style-v1 against classic-v1 at the same Casual, Club and Strong difficulty, using actual production depth and wall-clock limits. Use the app's own retained opening book: seeded selection of an opening line, first six plies forced identically for a two-game colour-swapped pair, then normal legal book continuations and engine play. Different pair seeds vary opening and choices. Record all SAN moves, final position, outcome, timings, source fingerprints and machine configuration. Classic randomness is explicitly seeded through its existing injection parameter. Morphy uses its existing seeded policy. No engine or time-limit tuning during measurement.

First checkpoint: 50 pairs / 100 games per difficulty. If uncertainty is too large, predefined extensions are 100 and 200 pairs. Report a conservative approximate Wilson score interval using independent pair means as bounded observations; z=2.4 accounts approximately for the three planned looks. Convert score intervals with the standard logistic Elo transform, anchored to Classic's fixed 900/1350/1800 app values. This measures internal relative strength, not FIDE or human performance. The three anchors themselves are not externally calibrated.

Eligibility requires at least 100 games, no unresolved games, a finite rating interval of total width at most 300 points, and a finite estimate within supported rating bounds. Report point estimates rounded to the nearest 25 for app use, retain full calculations. Absolute or near-complete domination cannot establish a precise rating: extend or test a neighbouring reference; do not invent a finite rating. Matches ending at the 1000-ply safety bound are unresolved, never draws; legal checkmate/stalemate/repetition/fifty-move/insufficient-material endings only. No evaluation adjudication or resignation. Report all results, including failures.

## Implementation boundary

New measured Morphy configuration will have a new opponent version while retaining style-v1 playing behavior. Its fixed per-difficulty ratings are tied to that configuration, so old beta saves remain unrated and results cannot be repriced. Explicitly test terminal settlement, undo, hints, takebacks, abandon preview, validated saves/receipts, account records and old-client write safety. Preserve neutral review. Unknown versions remain recoverable. No live player records are used in calibration.

Status: all 400 accepted games completed and legally replayed; all three difficulty estimates met the predeclared eligibility rule.

Harness verification: seven test cases first passed; independent TypeScript review caught short opening selection and eligibility at unintended intermediate sample sizes. Added two failing regressions and corrected sampling to eligible book lines of at least six plies, plus eligibility only at 50/100/200 pairs. The initial run is retained as excluded pilot evidence under Downloads/.../results with its original pilot-harness. Accepted runs use Downloads/.../measured and the corrected harness. No pilot estimate was used to select the protocol or ratings. Harness is included in canonical TypeScript, lint and formatting checks.

## Results

| Level | Games | Morphy wins / draws / losses | Estimate | Approximate interval | Fixed v2 rating |
|---|---:|---|---:|---|---:|
| Casual | 200 | 146 / 44 / 10 | 1188.06 | 1076.28–1299.85 | 1200 |
| Club | 100 | 14 / 76 / 10 | 1363.90 | 1248.05–1479.76 | 1375 |
| Strong | 100 | 17 / 74 / 9 | 1827.85 | 1711.73–1943.98 | 1825 |

Casual's first 100-game interval was 304 points wide, so the predeclared extension to 200 games was required. Club and Strong qualified at their first checkpoint. No accepted game was unresolved. The exact results, manifests, all synthetic moves and original measurement harness are retained in [the evidence directory](morphy-calibration-20260912/README.md).

Measurements used the immutable d0ef938 engine on this Mac (Node 22.23.0; see manifests for hardware). Casual and Club ran sequentially per level; the initial Strong pairs ran sequentially, then eight pair workers completed the remaining pairs using the same frozen engine and production time limits. CPU contention can alter achieved search depth; these results describe this run's conditions, not a device-independent certification. The confidence intervals cover match sampling only, not uncertainty in Classic's anchors, other hardware, arbitrary opening distributions or human/FIDE performance. The high draw rate and book-conditioned six-ply starts are visible limitations. Historical fidelity is not established by this benchmark.

The original worker's separate SHA-256 was recorded before its launch. Later tooling hardening adds worker self-fingerprinting and explicit CPU/platform/architecture checks for future runs; it does not rewrite the accepted harness or measurements. Statistical background: [official Fishtest mathematics](https://official-stockfish.github.io/docs/fishtest-wiki/Fishtest-Mathematics.html). No Stockfish engine or service was added.

## Compatibility and delivery checks

Measured Morphy is attack-development version 2 with the unchanged style-v1 engine. Version 1 beta games and their rematches remain unrated; explicitly selecting Paul Morphy in New game selects version 2. Classic and human rating formulas are unchanged. Measured receipts use the fixed level values above, once only; hints/takebacks still exclude rating and undo reverses only its own receipt.

Current local storage uses guest state-v3, account-v3 and guest-history-v2 keys, reading older keys only if the new authority is absent. Original bytes remain for recovery; even unchanged history is copied into the new generation. Old tabs cannot overwrite the updated app's pending progress. The wire save schema remains version 2. An additive record_client_policy table permanently requires the measured-rating client capability after an account first accepts a v2 Morphy configuration, including assisted games and after Classic/reset. It prevents older clients from repricing or losing measured progress. Rollback must use code compatible with these records and keep the new keys/table; do not restore the old application over new rated data.

Verification and deployment results are recorded below after completion.

Local source verification: Node 22.23.0; typecheck, lint, formatting and all 341 unit/integration tests passed. Full default-off production browser suite passed 90 tests with 4 pre-existing conditional skips across desktop and mobile emulation. Both account Morphy completion tests passed, including correct 1375 receipt, once-only reload and private archive/replay. Real worker, offline origin, safe service-worker update, guest/account isolation, multiplayer and notification cleanup paths passed. Independent TypeScript/calibration and code/security/storage reviews reported no remaining blockers. These are automated browser checks, not physical-device evidence.

Enabled production build: all 26 targeted desktop/mobile browser tests passed, including selection with measured numbers, keyboard accessibility in both themes, old beta resume, account measured settlement, replay, 320px layout and offline preservation. Setup screenshots were visually inspected. Both default-off and enabled production builds succeeded.
