# Fischer development failure disposition — 2 October 2026 BDT

Status: investigation complete to the limit of retained evidence. Original development schedule remains blocked; no seed rerun, new match, validation access, engine change or release action.

## Evidence inspected

The original evidence root is `.superpowers/sdd/2026-09-27-repair-and-engine-master-plan/strength-development-v1/`. The run log is `fischer-casual-run.log` directly under that root, not inside `fischer-casual/` as the previous session's next-step wording suggested.

Read and parsed the complete failed record and start marker. Node v22.23.0 legal replay through `verifyStrengthGame` passes without invoking search or playing a match. After 30 plies the recorded position is:

`r2r2k1/ppp1pp1p/6p1/5b2/2Q2B2/6P1/PPn2P1P/R3KB1q w Q - 2 16`

White is in check; the legal replies are Qxc2 and Ke2. This is nonterminal. The result remains null with reason `decision-failure` and message `Experimental incomplete calculation`.

The 7,959.756 ms value is elapsed time for the entire attempted game, not the failed calculation. Successful decisions account for 7,251.016 ms of startup plus calculation. The remaining time also includes orchestration, termination and game processing; it cannot be reported as the failed worker's timing. Neither the 15,000 ms worker capacity nor the 1,000-ply game capacity caused the reported stop.

## Causal trace and limits

Frozen `strength-worker.ts` checks reply success and request/game/revision identity, then validates `isExperimentResult`, before throwing the exact recorded message for a valid incomplete result. This rules out the runner's crash, identity-error, invalid-evidence and capacity-error paths as the recorded failure.

The frozen experimental worker passes no node cap or cancellation callback. The untimed match passes `turnDeadline: null`. `decideExperiment` therefore uses Casual's 200 ms budget and reserves 30 ms for ranking. It can return incomplete after preparation exhausts the deadline, or when `searchNextShortlistReuse` has no completed snapshot. The latter first computes a complete depth-two baseline across the root moves. Baseline work has deadline checks but no forcing-limit interruption. Once that baseline completes, subsequent deadline/forcing-limit interruption returns the completed snapshot rather than incomplete. Thus the code path establishes deadline exhaustion before the first complete comparison; it does not establish whether preparation or baseline search consumed it, nor why that particular run exhausted its budget.

The runner discarded the failed response: it threw a plain Error before returning its timing/detail object, and `playStrengthGame` retained only that Error's message. The record has 30 successful decisions and no failed decision object. The log contains only the aggregate failure and stack. Exact failed node count, attempted depth, interruption detail and startup/calculation split are unavailable. Do not invent them or label an unobserved performance cause as proven.

## Integrity and batch status

Recomputed all 129 source fingerprints in each of six manifests against `frozen-source-521fef2`, plus every declared worker bundle hash: zero mismatches. This establishes retained source/bundle integrity, not historical scheduling or CPU conditions.

| Batch | Saved games | Unresolved | Disposition |
| --- | ---: | ---: | --- |
| Tal Casual | 40 | 0 | Development only; mean 0.9125, interval 0.8375–0.975 |
| Tal Club | 40 | 0 | Development only; mean 0.8875, interval 0.8125–0.95 |
| Tal Strong | 40 | 0 | Development only; mean 0.5625, interval 0.4375–0.6875 |
| Fischer Casual | 1 | 1 | Stopped; no summary |
| Fischer Club | 0 | 0 | Frozen, unstarted |
| Fischer Strong | 0 | 0 | Frozen, unstarted |

Each Tal summary explicitly has qualification=false. Tal Strong's interval includes 0.5; these results do not establish improved strength under the validation gate.

Original Fischer artifacts, SHA-256:

- `fischer-casual-0-w.json`: `ecfdf2690a15bd15516c00c3f43fa036e3a0c8924208f6da76acafa3a10917fd`
- `fischer-casual-0-w.started.json`: `d8df7712b2dba8a2d426d41ae005e5459689df25b1d2931f82a34c58b46acc9c`
- `manifest.json`: `183b3200bab972b42dfc98d8331da989395815346ba82f9cc57df09859a9a545`
- `experiment.cjs`: `4b54584e9cfe52aa27e1e9c4d561da2bb37cad1748562db1e48046086fbe7923`

## Protocol disposition and concrete forward plan

The registered 29 September strength protocol says: “Stop the entire schedule at the first failure; never replace it with a draw or rerun its seed.” Preserve the failed leg and marker indefinitely. Do not resume the game, run its other color, or start the remaining Fischer levels as if this schedule passed. Current experimental identities remain default-off and unrated; older policies and receipts remain exact.

1. Prepare a separate runner revision that retains structured failure evidence before stopping: original validated reply, request identity, startup and calculation duration, failure stage and capacity/exit information. Add deterministic injected-failure tests; no replay of the failed seed is necessary. Keep original frozen runner/bundles/manifests unchanged. Obtain independent code and TypeScript review.
2. Register a separate diagnostic-development protocol before execution. Distinguish diagnostic positions from scored games; explicitly decide whether examining this failed position is allowed, without rewriting or replacing the original result. Do not assume a generic continuation authorizes overriding the registered no-rerun rule.
3. If a playing-policy change is justified, give it a new experiment identity, preserve version-two saved games, and review its compatibility and complete-game schedule before freezing. Do not silently increase Casual's budget, use arbitrary fallback moves, warm existing workers, or pool new results into old summaries.
4. Keep held-out validation inaccessible until development feasibility and the reviewed complete-schedule runner requirements are met. Physical-device and owner blind-personality checks remain separate.

Only this report and the ignored continuity ledger changed during the investigation. No product-code fix or fresh full-suite pass is claimed.
