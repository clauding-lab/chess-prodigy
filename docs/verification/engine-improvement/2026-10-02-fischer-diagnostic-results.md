# Fischer diagnostic results — 2 October 2026 BDT

The approved 13-position probe completed all 26 scheduled invocations. The historical failure did not recur. This is a diagnostic observation, not repair, reliability qualification or new strength evidence. No engine policy changed.

## Findings

| Observation | Failed position | Existing 12 development positions |
| --- | ---: | ---: |
| Full 200 ms Casual decision | Legal Qxc2, completed forcing depth 4 | 12 legal moves, all completed a comparison |
| Preparation across preflight + actual search | 3.05 ms | 2.44–4.23 ms |
| First complete baseline in full decision | 15.89 ms | 15.19–66.67 ms |
| Standalone fixed baseline | 94 nodes; 14.93 ms baseline work | All 12 completed depth 2, no interruption |
| Full worker startup, excluded from calculation budget | 169.70 ms | 166.47–191.34 ms |
| Full request calculation including message transit | 173.68 ms | 174.62–180.63 ms |

Preparation here includes parsing/counting prior positions, history fingerprinting and root legal/terminal checks; it does not isolate history parsing alone. The baseline compares moves and their immediate replies. The full search retains that completed comparison while attempting deeper search until its allotted time expires. A `deadline` interruption after a completed iteration is normal and still produces a valid move; the original failure had no completed comparison.

All full decisions used frozen Fischer2 Casual settings, its actual book and ranking rules, in fresh Node threads. All baseline-only calls completed exactly depth 2 without interruption under the predeclared node cap. None returned a book move. No resulting move was applied to a game.

## Limits and disposition

The observed failed position is inexpensive enough to complete its first comparison under this run's conditions. This does not explain why the original process exhausted its deadline, establish a failure probability, or prove every future decision will complete. The discarded original reply cannot be reconstructed. Scheduler pauses, memory collection and host load remain unverified possibilities, not established causes.

There is no evidence from this probe to justify increasing Casual's budget, changing its search, or removing its explicit incomplete response. Preserve current policies. The original complete-game attempt remains unresolved; Fischer Club/Strong remain unstarted. Do not resume or replace that original schedule, count this isolated successful response as a recovered game, or convert Tal's development results into qualification.

The best supported outcome is improved observability from commit 88f62c3 plus an honest non-reproduction result. Any later development run requires a separately reviewed prospective protocol that carries forward this failed attempt. A playing-policy change needs its own rationale, distinct identity and fresh evidence. Held-out tactical validation remains inaccessible.

## Method and environment

Protocol: `docs/superpowers/specs/2026-10-02-fischer-diagnostic-probe.md`. Node v22.23.0, Apple M5 Pro, arm64 macOS. Source archive 521fef2; added timestamps applied only to in-memory build copies. All 129 original source hashes and both diagnostic bundle hashes passed the post-run audit. The original failed game and marker retain their exact hashes. All 26 unique records and start markers are present; 13 full decisions and 13 fixed baselines passed their respective completion checks.

The larger full worker includes historical books and initializes differently from the much smaller baseline-only worker. Their startup times are not an optimization comparison. Instrumentation adds overhead and can alter deadline outcomes. Each position/mode ran once, sequentially; no warm-up or retries. A visible unrelated Python pytest process was using about one CPU core before the run, and a system PDF process about 13% of one core. This task's tests/benchmarks were stopped; other work was not terminated. These timings are descriptive measurements under that environment, not isolated performance certification or phone evidence.

The initial launch stopped before building bundles, creating the manifest or starting any invocation because the source archive omitted the ignored development dataset. The harness was corrected to use the retained worktree development dataset and cohort, verifying both against their existing manifest hashes. The failed preflight source and log are retained; no diagnostic row was repeated.

Pre-execution code and TypeScript reviews found error-response retention and error-summary optional-access bugs in the throwaway harness; both were corrected before any invocation. `node --check` passed; the error-summary access was checked with an unsuccessful reply. The harness is retained for evidence only and is not a product module. Product source/tests are unchanged from 88f62c3, whose full 1,093-test verification remains the applicable product evidence; no fresh full-suite claim is made here.

Artifacts: `2026-10-02-fischer-diagnostic-evidence.tar.gz` contains the protocol-fingerprinted manifest, reviewed throwaway harness and its failed preflight version/log, instrumented source, two bundles, all requests/results/start markers, summary and integrity audit.

Final independent review: code reviewer checked every scheduled record/marker, input identity, all 129 frozen source hashes, both bundle hashes and protocol hash, and recomputed the reported timing ranges. TypeScript reviewer checked harness corrections and report consistency. Both approved the evidence-only archive without further findings; neither reran search or inspected held-out tactical positions.
