# Versioned bishop-only dead positions

28 September 2026 BDT. Scoped R10 implementation under the approved repair plan.

[FIDE Article 5.2.2](https://handbook.fide.com/chapter/E012023) defines a dead position by the
impossibility of checkmate through any legal sequence, rather than whether mate can be forced.
The narrow classification added here is kings plus any number of bishops, with every bishop
confined to the same square color. This includes bishops produced by promotion and does not
depend on which player owns them. No pawns, knights, rooks or queens may remain. This is an
inference from the rule and bishop movement, not an assertion that FIDE enumerates this case.

Why the class is dead: bishops cannot leave their square color. A bishop check therefore checks
a king on that color; escape squares of the opposite color cannot be attacked or occupied by any
bishop. The other king cannot cover all those escape squares while remaining a legal distance
from the checked king. A king alone cannot deliver a legal check. Adding more bishops of that
same color does not change those restrictions. Any remaining knight, pawn, rook, queen or bishop
on the other color invalidates this proof and is excluded. Two knights are not declared dead
merely because they cannot force mate against a bare king.

`src/engine/board.ts` and all existing computer policies retain their exact behavior. The new
`rules-v2.ts` helper is available only for future explicitly versioned computer policies; no old
rating, rematch, receipt or calibration is changed by adding it.

Human games gain an authoritative `mp_games.rules_version`: existing rows receive 1 without
rewriting their game JSON; new invitations explicitly receive 2. After a legal move, version 2
applies the narrow extra classification before ordinary completion settles ratings/H2H. Existing
terminal results and ordinary mate/stalemate precedence are preserved. Existing waiting games
keep version 1 when joined. Summary/detail ownership and private histories are unchanged.

This is an additive local candidate migration. A deployed server must continue understanding
both human rule versions; rollback to a binary that ignores version 2 is incompatible once new
games exist. No production migration has run. All broader dead-position cases remain outside
this conservative material classifier.
