# Build ledger — plan: docs/superpowers/plans/2026-09-05-chess-prodigy-build-plan.md
User authorised autonomous production execution.
Dedicated greenfield workspace; original references preserved, no existing git branch changed.

| Task | Preflight/interface |
|---|---|
|1|Engine types/helpers supplied to 2,3,4,5.|
|2|Generic annotation prevents game/coach cycle; content immutable.|
|3|Pure transitions with explicit time/id; session settles rating+game together.|
|4|Worker identities and actual termination; consumed by 5.|
|5|UI consumes hook, never search directly; saves via 6.|
|6|Validated replay envelope; corrupt save protected until explicit recovery.|
|7|Cache app+worker; device checks distinct from emulation.|
|8|Local release candidate and checks; no deployment.|

Ruling: use this dedicated uninitialised directory rather than a git worktree; no branch is at risk.
Ruling: independent engine/coach/UI agents follow agreed interfaces while controller integrates state/worker/storage; wrong assumptions cost integration rework.
Ruling: physical device evidence stays pending if devices are unavailable; never infer it from emulation.

Task 1: in progress.
Task 2: in progress.
Task 3: tests first.
Task 4: pending.
Task 5: in progress.
Task 6: pending.
Task 7: pending.
Task 8: pending.

## Resumed 5 September 2026, 20:00 BDT
- Ruling: existing dedicated non-git workspace retained; no commits/publishing required. User explicitly authorised continued production build.
- Engine, coach, state and worker independently verified; core review identified 4 issues (corrupt coaching data, missing clocks, rollback inconsistency, root draw search); all reproduced red and fixed green, scoped reviewer approved.
- Storage implemented with 14 tests; hook with 6 tests; UI including keyboard and StrictMode dialogs implemented.
- Production entry now src/main.tsx. PWA manifest, local original rook icons, offline precache and explicit update prompt implemented.
- Dependencies moved to Node >=22.19, .nvmrc 22.23.0; lighthouse13.4.1/sharp0.35.4: npm audit zero vulnerabilities.
- Browser initial run revealed book argument mismatch and theme contrast; book red-green fixed. Second browser run 22/24 passing including real waiting-worker update, offline play, persistence and responsiveness. Remaining contrast correction under verification.
- Integration review: timeout/confirmation overlap and result blocking update control; fixes under way with regression tests.
- Physical Android/iOS device checks remain unavailable and must not be represented as passed.

## Final local candidate — 5 September 2026, 20:12 BDT
- Tasks 1–6: implemented and verified in the production entry, including storage replay/receipts, hook/worker integration, accessible UI and all content parity checks.
- Task 7: software/PWA/browser acceptance implemented and verified; physical Android/iOS acceptance remains pending, explicitly recorded in device-checklist.md.
- Task 8: independent reviews resolved, CI workflow written, README/governance/handoff and release report updated. Remote CI/hosting not run; workspace is non-git and no publishing performed.
- Final clean-install checks: install/audit 0 vulnerabilities; typecheck/lint/format/build pass; 149 tests/15 files pass; final browser suite 30/30 passes after correction of unnamed opening-prefix test assumption. Lighthouse 100 in both themes; native-worker heartbeat <=60.9 ms on this Mac.
- Ruling: retain exact motif prose and doubled-enemy-pawn detector semantics; positive legal fixture cannot exist. Document as preserved limitation, not an invented passing fixture.
- Ruling: preserve current non-git workspace and local candidate; branch/merge workflows do not apply. No destructive cleanup or remote publication.
- Review artifacts: docs/verification/core-review.md and integration-review.md; all reproduced findings resolved and scoped re-reviewed.
- Concrete local preview: http://127.0.0.1:4183 (built app; process started this session).
