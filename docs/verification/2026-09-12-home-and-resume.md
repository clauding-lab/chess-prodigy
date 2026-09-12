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

No physical-device verification is claimed. Morphy remains the existing measured style-v1 simulation; historical-game fidelity is a separate requested follow-up.

## Production

Deployed v2.2.0 from `47ce28937f919a4539398fdb51a546ffb583a5df` on 12 September 2026 BDT to `/opt/chess-prodigy/releases/2.2.0-20260912-47ce289-home`, hosted Morphy enabled. The transferred source archive SHA-256 matched `8a16872e75089351ce948b52fff1b8961b9a5d76bdeb21925ed49cd36d4a9454`. A clean target install, typecheck, all 349 tests and production build passed on Node 22.22.2. A consistent private backup at 13:56:28 BDT passed integrity_check before the atomic release switch; the previous release remains available.

Public HTTPS serves `assets/index-BKMbJgs3.js`, SHA-256 `d093a0a0d3f16245f50c807c60a6d4cc99144f353074a81a1254fe21cefb029f`, identical to the server artifact. Health returned 200/ok, unauthenticated private records returned 401, both with no-store. The service is active/running with zero restart loops and no error-priority journal entries after deployment.

Fresh isolated guest checks on the live site show Home without automatic setup, explanatory Classic/Morphy cards and explicit setup. A new Club Morphy game played two moves, returned Home, showed Resume game, required explicit forfeit before setup and retained exactly one rated loss after reload. The minimum-rating explanation was visually checked at 390px. Desktop and phone-size Home screenshots are retained with local evidence.

A separate v2.1 guest session played e4/c5 before deployment. The real waiting update deferred while active. After resignation and explicit Update now, the app loaded v2.2 Home automatically, preserving its exact game ID, moves, result and one rated-game count. No live player accounts or records were used for testing. Existing automated closed-app timeout, archive recovery and account-isolation coverage passed as described above.

Source is pushed to main. [GitHub checks for the deployed source](https://github.com/clauding-lab/chess-prodigy/actions/runs/34681892358) are tracked separately; no new release tag was requested.

## Linux preview contrast correction — v2.2.1

The first GitHub run passed 349 unit/integration and 93 browser checks, with four intentional skips, but failed the new desktop Home contrast check. Linux's DejaVu chess glyphs exposed 16 black pieces with insufficient contrast; their 0.65px outline was too thin at desktop size. The Mac fallback font had passed. Loading the server's DejaVuSans font in a local browser reproduced all 16 failures with the old CSS.

The correction uses a scalable 0.04em light outline for black pieces in the dark theme and a dark outline for white pieces in the wooden theme; other pieces retain their contrasting fill. An initial all-theme outline experiment exposed the opposite-colour cases and was rejected. With the theme-specific correction, unrestricted axe reports zero violations in both themes under the actual Linux font. Only Home preview styling changes; game behavior, playing-board styles and saves are untouched.
