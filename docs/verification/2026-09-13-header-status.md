# Account saving status — 13 September 2026 BDT

Application source: `5164f8fb74689ac807c320de679ce8cb2df35a28`.

Version 2.4.2 moves the existing account saving status onto its own centered line below
Leaderboard, H2H (when eligible), Play a friend, the account button and About. The wording
and saving behavior are unchanged. This is an isolated header release from main `35513d7`;
no Chigorin implementation, new save generation, rating or client-policy changes are included.

## Local verification

- Node 22.23.0: TypeScript checks, lint, formatting and all 426 tests across 46 files passed.
- Production build passed with `VITE_PERSONALITY_BETA=true`.
- Fresh headless Chrome using disposable local accounts at widths 390 and 1280 verified
  the status begins six pixels below all navigation controls, occupies the full bar width,
  and causes no horizontal overflow. About reports version 2.4.2. No page errors.
- The parent agent independently reviewed the exact two-file layout change with no findings.
- Existing Morphy playing code, ratings, policy 3, state-v5/account-v5/history-v4 authority,
  explicit update consent, dark default and older recovery generations are unchanged.

## Live delivery

- Exact-source [GitHub verification](https://github.com/clauding-lab/chess-prodigy/actions/runs/34710481495)
  passed: source checks, secret scan, 426 unit/integration tests and 116 browser tests, with
  eight existing intentional skips in the default-off personality build.
- Linux candidate installed and typechecked on Node 22.22.2; hosted-feature build passed.
  All 13 built-file SHA-256 fingerprints match the locally tested build.
- Consistent private backup completed successfully at 00:14:47 BDT.
- Activated `/opt/chess-prodigy/releases/2.4.2-20260913-5164f8f-header` at 00:20:23 BDT
  after the exact-source checks passed. Service active/running, exit status 0, restart count 0.
- At 00:21:47 BDT, public HTTPS health returned 200 with no-store, and all 13 public-file
  fingerprints matched the tested build. Fresh mobile-sized Chrome verified About version
  2.4.2, dark default, a legal guest game, reload/Resume with the position intact, and no
  horizontal overflow or page errors. Signed-in layout used disposable local accounts.
- Source is pushed on main. This record is a later documentation-only commit; deployed
  application source remains `5164f8f`. No additional release tag was requested.

Browser emulation is not physical-device evidence. No production player account or record
was used for checks. Existing installed copies retain explicit update acceptance.
