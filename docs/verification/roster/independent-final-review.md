# Independent final review — 19 September 2026 BDT

Reviewed base `bb28c03a067f310b7fec5b5d42fed567121a2cb4` through `6df27c7`, including Chigorin and the three-player expansion; Task4 scope `3950e91..6df27c7`. Read AGENTS/VISION, approved roster specification, Task4 brief/report, progress rulings, implementation and retained verification. Initial staged/unstaged diffs were empty. Read-only implementation review; this report is the only authored artifact. No measurements or passed suites were rerun.

## Findings

[LOW] Recovered beta games describe accepted measurement as pending

File: `src/game/eligibility.ts:8`

Issue: A preserved Spassky/Tal/Fischer game with `unratedReason: "beta"` correctly remains unrated, but its displayed explanation still says the player's strength measurement “is not yet accepted.” All three identities are now accepted and selectable. This contradicts the activated setup and does not explain why this particular older game stays unrated.

Fix: Describe the game historically, for example “Unrated beta — this game predates accepted strength measurement.” Preserve its null receipt and existing eligibility. Nonblocking copy issue; no rating/data-loss defect.

## Verdicts

- Task4 specification: APPROVE with the nonblocking copy note. Exact accepted values and exact identities are activated; default-off source, compatibility and local-only boundaries remain intact.
- Task4 code quality: APPROVE with the same note. Its only runtime-source change is the rating table. Test corrections follow actual preserved behavior rather than weakening a product requirement.
- Whole-branch specification: APPROVE. Reviewed exact routing, source/import validation, bounded distinct policies, Chigorin integration, setup/rematch, persistence generations, account protection, offline workers and measurement gate.
- Whole-branch TypeScript: APPROVE. No actionable type/async correctness defect found. Circular opponent/rating imports only dereference runtime functions/constants after module initialization; worker replacement cancels the previous worker before choosing a new entry.
- Whole-branch security: APPROVE. No introduced critical/high issue found in reviewed changes. Session-derived ownership, origin checks, bounded validated snapshots, parameterized transactional writes and monotonic client policy remain enforced. No new external service, credentials, arbitrary outbound destination or public private-game projection was introduced.
- Independent measurement-audit implementation: APPROVE. No blocking implementation issue found.

## Independent checks and supporting reasoning

`src/engine/opponents.ts`, `src/rating/opponents.ts`, setup and rematch paths use exact version/engine/random-policy/seed configurations. Values are Chigorin 1250/1350/1625; Spassky 1150/1325/1700; Tal 1200/1325/1700; Fischer 1250/1350/1675. New roster setup is flag-gated; unsupported identities are not substituted. Existing Morphy branches and fixed rating values remain intact. Rating math and human-game code did not change.

Reviewed rating settlement against surrounding session/schema/archive logic: fresh rated games settle one receipt, assistance excludes rating, undo restores its receipt, and stored beta/null-receipt games retain unrelated progress without retroactive settlement. The final above-floor tests explicitly calculate expected losses for all nine levels from valid 1600 progress; fresh browser losses legitimately stay at the unchanged 1400 floor.

`server/records.ts:217` rejects unsupported writes after schema validation while recovery remains readable. Its transaction derives ownership from the authenticated user, checks record version, raises minimum policy to 4/5 for Chigorin/roster independently of assistance, retains the maximum, and stores the validated original wire bytes through the original JSON representation. Reset does not delete protection. Account-v7/state-v7/history-v6 read older generations in order; corrupt current authority and failed new-key persistence block destructive fallback/transmission. Existing raw acknowledgements and pending ordering remain covered.

`src/engine/roster/policy.ts` filters documented continuations through legal moves, weights exact occurrence counts, checks terminal conditions, reserves 30 ms, uses completed neutral candidates, applies 100/150/50 loss guards and 240/360/240 caps, preserves mate priority and discards expired ranking. Inspected Spassky/Tal/Fischer feature preparation and bonus paths, including Tal's accepted-offer compensation and Fischer's advantage-preserving conversion prerequisites. Chigorin has its independent frozen policy/book, rather than using new shared helpers. Corpus parsing pins downloaded bytes, exact player aliases and exclusions; compact keys retain canonical legal-en-passant identity and book building checks collisions/count legality. Runtime imports compact books, not full PGNs.

`src/worker/client.ts:140` selects separate exact roster AI entries; neutral analysis remains in the existing worker. Existing request/game/revision checks, termination, retry identity and timeout budget remain unchanged. Workbox's explicit 8 MiB per-file cap covers the measured separate assets; no timeout widening or corpus pruning. The frozen diff across `src/engine`, `src/book`, `src/worker`, and `scripts/calibration` from `9a7ab6c..6df27c7` is empty, independently checked in this review.

Reviewed additive calibration dispatch/protocol manifests and `docs/verification/roster/calibration-audit.ts`. The audit independently derives the declared pair-Wilson estimates/rounding; checks pinned source archive/commit/inventory and transitive imports; enforces exact pair/color/seed identity; legally replays games from START, rejects post-terminal play, recomputes outcomes/repetition and first eligible checkpoint; compares logs and raw/canonical packed hashes. It has negative self-tests and non-overwriting output. It shares frozen chess-rule primitives and does not prove original elapsed-time search choices or per-move worker timing; those limitations are explicitly recorded. Accepted evidence is 1,100 complete new-roster games / 87,731 plies, with Tal/Fischer Casual extending to 100 pairs. No repeated measurement is warranted. Chigorin's separately accepted frozen measurement remains distinct.

## Verification evidence ruling

Retained logs and changed assertions support accepting the targeted corrections without rerunning unrelated passed suites:

- Full unit run: 535 passed; final expanded affected rating file: 10 passed afterward.
- Earlier full enabled browser matrix: 183 passed, 1 stale-build About failure, 4 skipped. Final rebuilt 2.6 About desktop/mobile cases are included in the 54/54 focused pass.
- Full default-off matrix: 160 passed, 6 account-rematch assertion failures, 22 skipped. The six assertions incorrectly expected enabled rematches under a default-off build; final flag-conditional cases pass 6/6.
- Final enabled 54/54 adds genuine Home-to-Start native replies/receipts for all three new players × all levels × both colors on desktop/mobile, plus remaining Morphy levels; earlier passing full coverage includes Chigorin. Test-only 1400-floor correction is independently supplemented by nonzero-delta unit checks.
- Final enabled/default 2.6 builds and source checks pass. Lighthouse is 100 in both themes. Controller's retained actual-app screenshot inspection and automated layout/accessibility checks support the visual gate.

These are multiple runs, not a clean full final browser run. The report accurately retains earlier failures. No physical phone, manual screen-reader or perceived-personality claim is inferred. Preview API refusals target isolated unused port 4317; private integration cases use disposable 4318. No new full rerun is justified by the actual changes reviewed.

## Residual rulings

Keep the accepted style/measurement limits: designed priorities are not reconstructed thought, shallow bounded search is not a tactical guarantee, and internal Practice Ratings are not human/FIDE strength. Future playing-policy changes require a new measured identity. Preserve old recovery keys, exact receipts, permanent policies, dark default and Home clock/resume behavior. Candidate remains local 2.6.0: no push, deployment, release tag or live-player-data action is authorized here. The single copy note does not require engine tuning or measurement repetition.

## Review Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | pass |
| HIGH | 0 | pass |
| MEDIUM | 0 | pass |
| LOW | 1 | note |

Verdict: APPROVE — one nonblocking beta-status wording correction recommended.

## Scoped final re-review — 19 September 2026 BDT

Independently reviewed `6df27c7..76337c56070fc877af9a7abb44203261ba463fb1` only. The sole LOW finding is resolved: `src/game/eligibility.ts:8` now describes the saved game's original unrated status without claiming measurement is pending. Exact legacy Morphy wording is unchanged. The only other source change removes the unused name import; no eligibility, receipt, engine, storage or account behavior changes.

The added assertion runs for each of the three recovered beta identities, alongside their existing null-receipt and unchanged-progress checks. Retained red evidence shows precisely those three assertions failing, followed by 10/10 green tests with exit 0. Narrow lint/format success is recorded in the integration report. The durable original review remains intact with its original scope and historical finding. No broad tests, build or benchmark were rerun; earlier build artifacts correctly remain identified as preceding this copy-only fix.

Task4 specification/quality, whole-branch specification/TypeScript/security, and measurement-audit implementation verdicts remain **APPROVE**. No open findings or new issues in the scoped diff. All previous measurement/device limitations and local-only publication boundaries remain in force.

## Final Review Summary

| Severity | Open count | Status |
|----------|------------|--------|
| CRITICAL | 0 | pass |
| HIGH | 0 | pass |
| MEDIUM | 0 | pass |
| LOW | 0 | resolved |

Verdict: APPROVE — sole finding resolved in `76337c5`; final local candidate review complete.
