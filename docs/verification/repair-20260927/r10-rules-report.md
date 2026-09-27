# R10 — isolated bishop-only rule correction

28 September 2026 BDT. Local candidate only.

The new conservative classifier covers kings and bishops all confined to one square color,
including promoted bishops. Opposite-color bishops, knights, pawns and major pieces are negative
fixtures. The rule and compatibility contract are in
`docs/superpowers/specs/2026-09-28-versioned-dead-positions.md`.

Existing computer `board.ts`, playing policies and ratings are untouched. Existing human rows gain
rule version 1 without changing original JSON; new invitations explicitly use version 2. The
extra classification runs after a legal move inside the existing completion transaction. Previously
finished games and ordinary mate/stalemate precedence remain unchanged.

Independent code and TypeScript reviews approved the narrow classifier/migration. Database review
caught unknown-version mutations bypassing the move-only guard. A failing HTTP regression was
fixed with a shared guard before any join/action mutation. Combined 31 tests passed. A follow-up
test installs a real pending opponent draw offer before raising the version, proving acceptance
is rejected by compatibility checks rather than absence of an offer; that focused test passed.
Game bytes, ratings, H2H, event and summary rows remain exact after rejected mutations.

The pure classifier and production invocation are covered, as are migration repetition and raw
byte preservation. A full legal-from-start HTTP game reaching the new promoted-bishop class has
not been retained; do not describe the pure position fixture as such a game. Existing real HTTP
threefold completion and transaction-failure tests cover the shared rating/H2H settlement path.
Future engine versions must explicitly adopt the new helper; no old computer game adopts it.
