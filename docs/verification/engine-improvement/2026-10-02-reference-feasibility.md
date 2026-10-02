# Tactical reference development feasibility — 2 October 2026 BDT

All 24 scheduled reference calculations completed: the original 12 development positions at independent forcing depths 3 and 4. Every result reached its requested depth without interruption and provided an exact finite score for every legal root move exactly once. This satisfies the feasibility prerequisite on this small development cohort; it does not establish feasibility on every held-out position or grant tactical qualification.

Used unchanged archived E1 `next-neutral-v1`, constant-zero search clock, 10,000,000-node cap and forcing limits4/12, one fresh worker per invocation. No candidate moves or validation positions were examined. No production search, rating, saved game, original benchmark or deadline changed. All rows and markers are retained; no invocation was repeated.

The manifest freezes the source, bundle, harness, dataset, protocol, schedule and machine before execution. Code and TypeScript reviewers approved the bounded harness before use. Each result is checked against the expected position/history/policy/settings, canonical legal-root coverage and best-score consistency. The prospective120-second resource cap was not reached. Measured elapsed times are diagnostic only, with ordinary external host activity uncontrolled.

This opens the next implementation prerequisite: a complete-schedule tactical runner with strict coverage, retained failures and one-submission controls. It does not unlock validation execution or remove the original unresolved Fischer game. The original failed schedule stays stopped.

Artifacts are retained in `2026-10-02-reference-feasibility-evidence.tar.gz`. Product source remains at88f62c3; no new full product-suite claim is made for this evidence-only step.

Measured maximum:346,079 nodes and6,746.86ms calculation time for a single invocation, below the10m-node and120s development caps. Depth3 totaled368,806nodes; depth4 totaled2,001,887nodes. Independent post-run review checked every record/marker, canonical root coverage, selected best, history and source/runner/bundle/protocol/dataset hashes, and approved these limited conclusions.
