# Direct Morphy plans decision record — 12 September 2026 BDT

This record preserves the implementation and release decisions for version 4 / `plans-v1` outside
the local task ledger. Each decision states why it was taken and the practical cost if the premise
proves wrong. The accepted product scope is in the
[direct Morphy plans specification](../../superpowers/specs/2026-09-12-morphy-plans.md).

1. **Start from clean `main`, not the rejected experimental branch.** The failed learned-model
   experiments remain available as evidence, but their unused models and large fit artifacts do not
   ship. If an experimental helper later proves useful, it must be reviewed and adapted explicitly.
2. **Give the designed policy its own behavioral acceptance criteria.** The approved implementation
   is judged by position-derived development, central-break and coordinated-attack progress plus its
   tactical guard. It does not rewrite the failed historical-fit thresholds. The cost is that passing
   engineering checks still cannot prove that play will feel like Morphy to a person.
3. **Measure the engine before making version 4 current or rated.** A durable unrated version-4 save
   would become invalid when the identical configuration became rated. Waiting avoids that migration
   trap, at the cost of postponing normal user play until measurement is accepted.
4. **Derive plans from the current position instead of serializing plan memory.** Position, seed and
   ply already preserve deterministic resume and replay identity. The cost is that a goal may change
   after the opponent changes the board, even when a person might continue the earlier idea.
5. **Treat the owner's “ok” and “go on” as authorization for this design and delivery.** The work stays
   within the approved actual-app, source-push and existing-host scope. If that interpretation is
   wrong, the reversible implementation and documentation would need reviewed correction.
6. **Reserve 30 ms for plan ranking inside the existing move budget.** Letting neutral search consume
   the full deadline would routinely prevent the designed policy from ranking safe alternatives.
   The cost is slightly less neutral-search time; the complete-game measurement includes that trade.
7. **Correct two faulty chess fixtures while retaining the originals as evidence.** The original
   centre position made `d4` lose the bishop on c4 by 325 centipawns, and the original pinned knight
   could not reach the enemy king area even without its pin. The unsafe centre position remains a
   guard test; corrected positions test the intended properties. The cost is extra fixtures and a
   review obligation to confirm their real chess meaning.
8. **Set the useful central-break term to 150 centipawns before calibration.** In the corrected
   position, `d4` was safely inside the 100-centipawn neutral guard but the initial 70-point term did
   not express the approved immediate-break priority. The 150-point term was selected before any
   strength games, without a coefficient sweep; the 100-point guard and 240-point maximum stayed
   fixed. The cost was possible playing-strength loss, handled by fresh complete-game measurement.
9. **Add an optional fifth absolute-deadline argument to `searchRootCandidates`.** It caps root search
   at the outer move deadline minus the reserved ranking time, so setup elapsed before search cannot
   extend the total budget. Existing four-argument callers retain their relative budget. The cost is
   one additive API parameter that callers using a common deadline must pass correctly.
10. **Discard a whole incomplete search iteration, including a mate found before the iteration ends.**
    Publishing mixed-depth alternatives would violate the complete-depth contract. A completed mate
    always outranks style, but at a rare deadline boundary the legal fallback may miss a mate seen in
    an unfinished iteration. The reviewer reproduced and accepted that bounded cost.
11. **Run the full enabled browser matrix locally and use CI for the full default-off matrix.** The
    local enabled run exercises gated version-4 journeys in real Chrome; CI repeats type checking,
    lint, formatting, unit/integration tests, a default build, the default browser suite and secret
    scanning on the exact pushed source. Repeating the same full default browser suite locally would
    add time without distinct coverage. Deployment remains blocked until CI passes.

These decisions preserve versions 1–3, their exact ratings and receipts, the documented repertoire,
the permanent dark default, private ownership and explicit service-worker updates. Future playing
policy or repertoire changes require a new internal opponent version and fresh measurement.
