# Saved-state storage implementation

Verified on 5 September 2026 (BDT).

The version 1 save envelope stores the game, rating and preferences together under `chess-prodigy-state-v1`. Reads treat browser storage as untrusted input: malformed JSON, invalid fields, forged boards, illegal histories, altered repetition counts and inconsistent rating receipts return `corrupt` while leaving the stored value untouched. Storage access failures return `unavailable`; writes report failure without changing the playable in-memory session.

Validation replays every recorded move from the standard starting position. It compares each recorded pre-move position, the resulting position and the positive repetition counts with the saved game. Zero-count repetition entries are accepted because undo deliberately retains those tombstones. Finished rated games require a receipt that matches the game identity, prior rating, current rating and latest rating-history entry.

Legacy `chess-fide-rating-v1` data is considered only when the authoritative key is absent and only after rating validation. A corrupt authoritative save is never hidden by valid legacy data.

Loading a valid live game applies one timestamp-based clock tick. If elapsed closed time expires the active clock, normal session reduction records the timeout and rating receipt together; saving and loading that settled session again does not add a second rated game.

## Verification

- `npm test -- tests/storage/store.test.ts`: 11 tests passed.
- `npm run typecheck`: initially exposed nullable browser-storage integration in `src/game/useGame.ts`; the storage boundary now explicitly accepts `StorageLike | null`. A fresh final run is recorded in the task handoff.
- `npm test`: storage and the other logic suites passed. Three unrelated UI tests failed: two use an unavailable `toHaveFocus` matcher, and one leaks a prior rendered board so an accessible-name query finds duplicates.

Browser persistence integration belongs to the controller/browser-test owners and was outside this storage-file assignment.

## Controller verification update

The historical checks above were followed by three additional corruption regressions and fixes: 14 storage tests now pass. Earlier UI setup failures were fixed. See release-report.md for the final 149-test and 30-browser-journey results and re-reviewed validation changes.
