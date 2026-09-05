# Production UI implementation

Date: 5 September 2026 (BDT, UTC+6).

The production React interface now consumes `useGame` and its worker, storage, rating and sound controls. It ports the wooden and dark layouts, board and player bars, move list, coaching and rating panels, setup, promotion, result, review and confirmation dialogs. Opening and motif prose remains sourced from the existing typed book and motif modules.

Accessibility work includes keyboard-operated board squares, named promotion choices, pressed state on setup and coach controls, modal focus trapping and restoration, result and error announcements, visible focus, reduced motion support and theme variables inherited by body-level modal portals. The setup dialog alone pauses game automation; confirmation, result and review dialogs do not pause clocks.

Persistence failures and corrupt saves remain playable and display an explicit recovery action. Engine failures display a plain-language retry action. FEN copying uses the clipboard when available and exposes a selectable field if clipboard access fails.

Focused verification is recorded in the task handoff after fresh UI tests, strict TypeScript checking and linting. Physical mobile, installation and offline evidence belong to the later release checkpoint and are not claimed here.

## Controller verification update

Timeout/confirmation overlap and result dismissal were fixed after independent review. The complete production browser suite and both-theme accessibility results are recorded in release-report.md; earlier implementation-only counts are historical.
