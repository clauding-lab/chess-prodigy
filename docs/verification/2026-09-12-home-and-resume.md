# Home and resume — 12 September 2026 BDT

Owner approved replacing automatic setup with an explanatory home screen, a prominent saved-game Resume button, explicit resume-or-forfeit before replacing unfinished games, and clocks that keep running across Home/app closure. Branch codex/home-and-resume, base 5c887ac. No engine-policy, rating-formula, account-wire or database changes.

## Behavior

Home shows the saved position, current clocks or completed result, Classic/Morphy introductions, optional Morphy biography/source, and existing progress/navigation. Starting or rematching any started unfinished computer game first requires Resume game or Forfeit and continue. The warning uses the current opponent's rating, explains the floor, and reports no change for assisted games. Forfeit settles elapsed time first, archives/persists the completed game and only then permits setup. Failed saving preserves the result and exposes recovery on Home.

Timed clocks continue on Home. On reopening, elapsed wall time settles any timeout and rating once before resumption. The stored deadline is not paused by closing the app; closed-browser practice results are reconciled when the app next runs, rather than by a server timer. A timeout against a bare king remains a draw. Human matches remain untimed. Untimed AI work pauses on Home; timed AI work continues, and repeated Home/Resume navigation cannot restart its minimum reply deadline.

## Verification

Eight new React behavior tests cover initial Home/opponent selection, resume and forfeit with exactly one receipt/archive, assisted no-change forfeits, reopening after timeout, timeout on Home, timeout while the forfeit dialog is open, preserving a pending timed AI reply through repeated navigation, and failed archive recovery. Regression tests failed before their corresponding fixes. All 349 unit/integration tests pass across 41 files. Typecheck, lint and formatting pass.

Independent code review caught the timed-reply navigation reset; its failing test reproduced the issue before the effect was fixed. Review of the corrected timed behavior found no remaining issue. Existing browser journeys now enter play through the actual home-screen buttons, including account remounts. New desktop/mobile journeys check both themes, accessibility, overflow, setup cancellation, closed-game timeout reconciliation and once-only reload.

Final independent review approved the save-failure handling and reran 70 focused game, storage and account tests successfully. The complete default-off production browser suite passed 94 tests with four existing conditional skips across desktop/mobile. All unrestricted axe accessibility checks passed on Home in both themes. Staged-source secret scan found no leaks.

The enabled production build passed all 30 targeted desktop/mobile checks for Home, personality selection/resume, rated Morphy, account history, rematches and offline replay. Lighthouse accessibility scored 100/100 in both themes. Its setup helper now follows Home → New game → Start and waits for visible game status instead of an obsolete save key; independent review approved that tooling change. Screenshots were visually inspected: [desktop](home-20260912/desktop-dark.png), [phone-size](home-20260912/mobile-dark.png), and their wooden-theme counterparts in the same directory. Detailed logs and Lighthouse reports are retained in Downloads/chess-prodigy-home-20260912 on the development Mac.

Production deployment evidence will be added after completion. No physical-device verification is claimed. Morphy remains the existing measured style-v1 simulation; historical-game fidelity is a separate requested follow-up.
