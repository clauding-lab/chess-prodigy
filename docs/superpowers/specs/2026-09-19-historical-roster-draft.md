# Historical roster expansion — design proposal, 19 September 2026 BDT

Status: owner approved the detailed design on 19 September 2026 BDT after choosing more exaggerated
styles. No Spassky/Tal/Fischer engine is implemented by this document itself.
The owner requested Chigorin, Spassky, Tal and Fischer. Chigorin already has an approved specification
and a completed independently accepted measurement, so its integration continues separately.

## Player-facing result

Keep Classic and Paul Morphy. Add Mikhail Chigorin, Boris Spassky, Mikhail Tal and Bobby Fischer as
separate opponent choices, each at Casual / Club / Strong after its own measurement qualifies.
Dark remains the default. Each Home card has a short introduction, a direct Wikipedia link and a
Play button; no biography dropdown. Show honest internal Practice Ratings without implying human
championship strength. Games, Resume, rematches, private records and neutral coaching work for each.

Recommended order is finish Chigorin, then Spassky, Tal, Fischer. Each new opponent gets its own
implementation/behavior/measurement checkpoint before proceeding to the next.

## Proposed distinct playing priorities

### Boris Spassky — buildup, then attack

Make the phase change conspicuous: patiently complete development and improve the least active piece,
then decisively open the centre or switch to coordinated king attack when the pieces and king safety
support it. In closed positions prepare a useful pawn break; in quiet open positions activate bishops
and rooks. Prefer a purposeful multi-piece attack once ready rather than alternating aimlessly between
small bonuses. Test both colors and multi-turn transitions between buildup, central breaks and attacks.

This is a designed interpretation of versatile play, not a reconstructed thought process.
[FIDE's Spassky page](https://museum.fide.com/champions/boris-spassky) includes Kramnik's description
of his universal play; [ChessBase's introduction](https://books.chessbase.com/en/master-class-vol-17-boris-spassky/introduction)
also discusses his attacking play. These are qualitative context, not quantitative engine weights.

### Mikhail Tal — sharp play and speculative sacrifices

Strongly prefer forcing activity, opening useful lines toward the king, retaining attacking pieces
and bringing several distinct pieces into the attack. Give Tal a larger but bounded tolerance for
assessed positional loss than the others, allowing speculative material offers with visible attacking
compensation. Never reward simply losing material. A sacrifice candidate needs concrete line access,
king exposure or coordinated attacking progress; completed neutral search must still admit it inside
the declared limit. Mate dominates style. Test supported sacrifices and superficially similar unsound
offers that must be rejected. Quiet positions still require useful moves. Shallow Casual search cannot
reproduce Tal's intuition; explain the design modestly.

[FIDE's Tal page](https://museum.fide.com/champions/mikhail-tal) documents his combinations,
sacrifices and pursuit of initiative. The implementation chooses verifiable positional proxies.

### Bobby Fischer — relentless pressure and conversion

Strongly prioritize purposeful development, useful bishop activity, sustained pressure on weak pawns
and open files, then favorable simplification, active king and supported passed pawns when converting
an advantage. Use a stricter tactical-loss tolerance than the other two; amplify pressure through
preference among sound moves rather than through speculative material loss.
Trades are not automatically good: test that they retain the advantage and do not abandon an attack
or create a losing pawn ending. Preserve tactical wins over positional preferences.

Sources to ground the design include Fischer's own game analysis reproduced by
[ChessBase](https://en.chessbase.com/post/rare-video-of-bobby-fischer-analyzing--2-161013) and
the bishop-pair examples in [The Winning Academy](https://en.chessbase.com/post/the-winning-academy-5-what-to-do-with-a-bishop-pair).
The proposed priorities are design choices inspired by games, not a claim that these exhaust his style.

## Historical moves and sources

Use [PGN Mentor's catalog](https://www.pgnmentor.com/files.html) for each player's game collection.
Its current catalog lists Spassky2231, Tal2431 and Fischer827 games; these are source counts before
our validation, not promised accepted counts. Preserve exact downloaded bytes, fingerprints and
retrieval dates. Legally replay ordinary games with unambiguous player identities; retain explicit
exclusions for duplicates, illegal histories, odds, setups and consultation games.

At matching nonterminal positions use only that player's legal documented continuations, weighted
by retained occurrence counts. Do not substitute another opponent's opening book. Only compact
repertoire data enters the app; full source archives and validation evidence remain outside runtime.

## Architecture and compatibility

Keep existing Morphy and Chigorin playing code and repertoires frozen. Give each new player an exact
versioned identity (`spassky`, `tal`, `fischer`; version1; distinct `*-plans-v1` engines) with saved
unsigned32-bit seed and `seeded-per-ply-v1` policy. Route by exact identity, never by display name.
New helpers may be shared by the three new engines, but cannot silently change an existing opponent.
Plans derive from position/seed/ply; no unsaved plan memory.

Reuse complete-depth neutral candidate search. Candidate-loss guards below neutral best are100
centipawns for Spassky,150 for Tal and50 for Fischer (100 is one pawn of engine evaluation).
Preference bonuses are capped at240 for Spassky/Fischer and360 for Tal. These are risk limits,
not a claim that search can detect every blunder. Make style visible through position-specific
priorities within those limits rather than arbitrary randomness.
Keep production difficulty deadlines and reserve30ms inside them for preference ranking. Complete
mate scores dominate preferences; incomplete or expired ranking returns the neutral legal fallback.
Declare the final exact coefficients and behavioral criteria before strength measurement.

Give each new opponent its own worker entry and compact book, loaded only when that opponent thinks.
The existing worker continues handling Classic/Morphy/Chigorin and neutral analysis; old playing code
is unchanged. Node calibration uses the same pure new engines through an additive roster dispatcher.
Retain request/game/revision checks, cancellation by worker termination and failure recovery.
Precache all worker assets for offline play. Measure book/worker sizes and startup time before freeze;
allow an explicit per-file cache ceiling of8MiB for the new full repertoires, with a build failure
requiring lossless packaging improvement if any file exceeds it. No silent corpus pruning. Test fresh
worker startup within the existing client timeout on desktop/mobile emulation; do not simply widen
the timeout to hide a loading failure. Installed updates remain explicit and preserve active games.

For this three-opponent expansion use guest state-v7/account-v7/history-v6 and client policy5.
The client recognizes all three exact identities, but normal setup stays unavailable per opponent
until its ratings are accepted. Any accepted new-identity game, including assisted games, raises the
server's permanent minimum to5; reset/restart cannot lower it. Preserve original wire acknowledgements
and all prior recovery locations. Wire schema stays2. Unknown or incompatible opponents remain unavailable,
never substituted. Preserve pending account writes and private ownership.

## Verification and measurement

Before engine code, declare off-book behavioral positions for both colors, multiple-turn plans,
pinned pieces, tactical traps, mates, endgames, legal fallback and bounded deadlines. Test actual
selected moves, not only feature scores. Independent reviewers check behavior and tactical reliability.
Actual-app checks cover selection, both colors, all difficulties, timed/unlimited play, assistance,
rating receipts, account ownership/conflicts, reload, rematch, history/replay, mobile layout and offline.

Freeze each reviewed policy separately. Fresh complete games against unchanged same-level Classic,
from START, swapped-color pairs, no adjudication,1000-ply bound, declared50/100/200-pair checkpoints,
first eligible stopping point, z2.4 approximate pair-Wilson interval width<=300 and no unresolved games.
Independently replay raw games, verify identities/fingerprints and calculations, then activate fixed
nearest25 ratings. No reused Morphy/Chigorin rating values and no guessed strength hierarchy.
Any failed level withholds that opponent's rated release; do not change playing policy mid-measurement.

## Decisions for owner review

The owner selected more exaggerated styles over the initial conservative proposal and explicitly
approved this detailed design. This revision
implements that preference with different plan priorities and risk limits, particularly Tal's
speculative attack versus Fischer's stricter precision. Chigorin proceeds under its earlier approved design.
