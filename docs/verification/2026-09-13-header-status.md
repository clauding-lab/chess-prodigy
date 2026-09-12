# Account saving status — 13 September 2026 BDT

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

Live delivery evidence will be appended after deployment verification. Browser emulation
is not physical-device evidence. No production player account or record is used for checks.
