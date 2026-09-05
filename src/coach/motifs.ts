import {
  DIAG,
  FILES,
  KG,
  KN,
  ORTH,
  colOf,
  idx,
  inB,
  isAttacked,
  kingSq,
  rowOf,
  sqName,
} from "../engine/board";
import { VAL, nonPawnMaterial } from "../engine/eval";
import type { Color, Piece, Position, Move } from "../engine/types";
import type { GameResultLike, Motif, MotifCard, MotifKey } from "./types";

export const MOTIFS: Record<MotifKey, MotifCard> = {
  fork: {
    name: "Fork",
    kind: "tactic",
    origin:
      'One of the oldest tactical ideas; the term comes from 19th-century English chess writing. The knight fork of king and queen is the classic "family fork".',
    plan: "One piece attacks two or more targets at once. The opponent can save only one, so material is won. Watch for it whenever a knight lands near the king and queen.",
  },
  pin: {
    name: "Pin",
    kind: "tactic",
    origin:
      "Philidor described pins in 1749; Ruy López's 3.Bb5 is chess's most famous positional pin. An absolute pin (to the king) makes the pinned piece legally immobile.",
    plan: "A line piece attacks a piece that cannot move without exposing something more valuable behind it. Pile on the pinned piece, or use its immobility elsewhere.",
  },
  skewer: {
    name: "Skewer",
    kind: "tactic",
    origin:
      "The term was coined by Edgar Pennell in the 1930s for the reverse pin: the valuable piece is in front.",
    plan: "Attack a valuable piece along a line; when it moves, capture the piece behind it. Rook and bishop checks on open lines produce most skewers.",
  },
  discovered: {
    name: "Discovered attack",
    kind: "tactic",
    origin:
      "A staple of Greco's 17th-century combinations. Legall's mate (1750) is the oldest famous example of a discovered attack combined with a queen sacrifice.",
    plan: "Moving one piece unmasks an attack from another. The moving piece can make its own threat, so the opponent faces two problems in one move.",
  },
  doublecheck: {
    name: "Double check",
    kind: "tactic",
    origin:
      "The most forcing move in chess: Réti's mate and the Anderssen–Kieseritzky Immortal Game (1851) turn on it.",
    plan: "Two pieces check at once, so the king must move; capturing or blocking cannot answer both. Often the prelude to mate.",
  },
  backrank: {
    name: "Back-rank mate",
    kind: "tactic",
    origin:
      'A pattern as old as castling. The remedy, a "luft" (air) for the king with h3 or ...h6, is one of the first defensive habits players learn.',
    plan: "A rook or queen delivers mate on the first rank because the king's own pawns block its escape. Check the back rank before every trade of rooks.",
  },
  sacrifice: {
    name: "Sacrifice",
    kind: "tactic",
    origin:
      "The romantic school (Anderssen, Morphy) built whole games on sacrifice; Tal made intuitive sacrifices an art in the 1960s.",
    plan: "Material is given up for a concrete return: mate, a decisive attack, or a winning endgame. If the return is not concrete, it is a blunder with better publicity.",
  },
  gambit: {
    name: "Gambit pawn",
    kind: "tactic",
    origin:
      'Ruy López borrowed "gambetto" (a wrestler\'s trip) from Italian in 1561 for a pawn offered in the opening.',
    plan: "A pawn is offered for time, open lines and initiative. The gambiteer must keep the pace up; the defender's job is to consolidate and cash in the pawn later.",
  },
  castle: {
    name: "Castling",
    kind: "development",
    origin:
      'Evolved from the medieval "king\'s leap"; the modern rule was standardised by the 17th century in Italy and France. It is the only move that shifts two pieces at once.',
    plan: "Tuck the king behind its pawns and bring the rook towards the centre. Castling early is sound advice; castling into a pawn storm is not.",
  },
  castleQ: {
    name: "Queenside castling",
    kind: "development",
    origin:
      "Rarer than kingside castling because it takes one move longer to prepare. Opposite-side castling (one king each wing) is the recipe for mutual pawn storms, as in the Sicilian Dragon.",
    plan: "The king goes to c1/c8 and the rook lands on the d-file at once. It signals an intention to attack with the kingside pawns.",
  },
  fianchetto: {
    name: "Fianchetto",
    kind: "positional",
    origin:
      'Italian for "little flank". The hypermoderns (Réti, Nimzowitsch, Grünfeld) made it central to their theory in the 1920s: control the centre from a distance.',
    plan: "A bishop on the long diagonal exerts pressure across the whole board and shelters the castled king. The knight's pawn in front of it must not be traded away lightly.",
  },
  duo: {
    name: "Central pawn duo",
    kind: "positional",
    origin:
      "The classical ideal, championed by Tarrasch: two pawns abreast on e4 and d4 (or e5 and d5).",
    plan: "Side by side, the pawns control four central squares and can advance to gain space. The duo is strong while it stays mobile and supported.",
  },
  iqp: {
    name: "Isolated queen's pawn",
    kind: "positional",
    origin:
      "The great strategic debate of the classical era. Tarrasch praised its dynamism; Steinitz and later Nimzowitsch treated it as a target to blockade.",
    plan: "The side with the IQP has space and open lines and should attack before the endgame. The other side blockades on the square in front and trades pieces.",
  },
  doubled: {
    name: "Doubled pawns",
    kind: "positional",
    origin:
      "Philidor warned against them in 1749. Doubled pawns cannot protect each other and leave a half-open file.",
    plan: "For the side accepting them: use the open file and extra central control. For the opponent: fix them and attack the base.",
  },
  passed: {
    name: "Passed pawn",
    kind: "positional",
    origin:
      'Nimzowitsch: "a passed pawn is a criminal which should be kept under lock and key." Its promotion threat decides most endgames.',
    plan: "No enemy pawn can stop it. Support it from behind with a rook and advance it in the endgame. The opponent must blockade it with a piece.",
  },
  outpost: {
    name: "Outpost",
    kind: "positional",
    origin:
      'Nimzowitsch defined it in "My System" (1925): a square in the enemy camp protected by a pawn and immune to enemy pawns.',
    plan: "A knight on an outpost is worth a rook, Nimzowitsch claimed. Occupy it, support it, and let the opponent work out how to dislodge it.",
  },
  openfile: {
    name: "Rook on an open file",
    kind: "positional",
    origin:
      "Rook play was systematised by the classical school; Nimzowitsch's rule was that the open file exists to be invaded to the seventh rank.",
    plan: "A rook on a file without pawns can penetrate. Double the rooks on it before the opponent contests it.",
  },
  seventh: {
    name: "Rook on the seventh",
    kind: "positional",
    origin:
      'Nimzowitsch called the seventh rank the rook\'s "ideal". Two rooks there are the "pigs on the seventh", so named for the way they devour pawns.',
    plan: "A rook on the seventh attacks pawns from the side and confines the king. It is often worth a pawn to get it there.",
  },
  bishops: {
    name: "Bishop pair",
    kind: "positional",
    origin:
      "Steinitz identified the two bishops as a long-term advantage in the 1880s. In open positions they are usually worth about half a pawn.",
    plan: "Open the position and avoid trading a bishop for a knight. The side without the pair wants a closed centre and secure knight squares.",
  },
  pawnbreak: {
    name: "Pawn break",
    kind: "positional",
    origin:
      "Philidor taught that pawns should advance in phalanx and that the pawn lever opens the game at the right moment.",
    plan: "A pawn advance that contacts an enemy pawn to open lines or shift the structure. Timing is everything: break when your pieces are ready and the opponent's are not.",
  },
  minority: {
    name: "Minority attack",
    kind: "positional",
    origin:
      "The signature plan of the Carlsbad structure, worked out in the 1920s and turned into a weapon by Botvinnik in the QGD Exchange.",
    plan: "Two pawns advance against three to create a weak pawn (usually on c6) rather than to win space. Patient, and hard to meet.",
  },
  opposition: {
    name: "The opposition",
    kind: "endgame",
    origin:
      "The foundation of king-and-pawn endings, known since Philidor. The side not to move, with the kings facing one square apart, holds the opposition.",
    plan: "Whoever must move has to give way. Use it to force the enemy king back or to escort a pawn to promotion.",
  },
  activeking: {
    name: "Active king",
    kind: "endgame",
    origin:
      'Steinitz\'s principle: "the king is a strong piece, use it." In the endgame the king becomes a fighting unit worth about a minor piece.',
    plan: "Once the queens are off, march the king towards the centre and the enemy pawns. The more active king usually wins the pawn endgame.",
  },
  enpassant: {
    name: "En passant",
    kind: "rule",
    origin:
      "Introduced in the 15th century alongside the pawn's double step, so a pawn could not sneak past an enemy pawn's guard. Italy only adopted it fully in the 1880s.",
    plan: "A pawn that has just moved two squares can be captured as if it had moved one, but only on the very next move.",
  },
  promotion: {
    name: "Promotion",
    kind: "rule",
    origin:
      "Medieval rules promoted only to a queen (then a weak piece). Modern promotion to any piece dates from the 19th century.",
    plan: "A pawn reaching the last rank becomes a queen (usually). The whole endgame is about creating and escorting the pawn that will get there.",
  },
  underpromotion: {
    name: "Underpromotion",
    kind: "rule",
    origin:
      "The Saavedra position (1895) is the most famous underpromotion: a rook, because a queen would allow a stalemate trick.",
    plan: "Promoting to a knight gives a check or fork a queen could not; a rook or bishop avoids stalemate. Rare, and worth understanding.",
  },
  check: {
    name: "Check",
    kind: "tactic",
    origin:
      'The word comes from the Persian "shah" (king). Announcing check aloud was customary until the 20th century.',
    plan: "The king must be attended to at once, which makes check a way to gain tempo. A check with no follow-up merely helps the king find a better square.",
  },
};

function attacksFrom(board: Position["board"], square: number): number[] {
  const piece = board[square];
  if (!piece) return [];
  const row = rowOf(square),
    col = colOf(square),
    kind = piece[1],
    out: number[] = [];
  if (kind === "p") {
    const direction = piece[0] === "w" ? -1 : 1;
    for (const dc of [-1, 1])
      if (inB(row + direction, col + dc)) out.push(idx(row + direction, col + dc));
    return out;
  }
  if (kind === "n" || kind === "k") {
    for (const [dr, dc] of kind === "n" ? KN : KG)
      if (inB(row + dr, col + dc)) out.push(idx(row + dr, col + dc));
    return out;
  }
  const directions = kind === "b" ? DIAG : kind === "r" ? ORTH : [...DIAG, ...ORTH];
  for (const [dr, dc] of directions) {
    let rr = row + dr,
      cc = col + dc;
    while (inB(rr, cc)) {
      out.push(idx(rr, cc));
      if (board[idx(rr, cc)]) break;
      rr += dr;
      cc += dc;
    }
  }
  return out;
}

function attackersOf(board: Position["board"], square: number, color: Color): number[] {
  const out: number[] = [];
  for (let i = 0; i < 64; i += 1)
    if (board[i]?.[0] === color && attacksFrom(board, i).includes(square)) out.push(i);
  return out;
}

const pieceValue = (piece: Piece): number => (piece[1] === "k" ? 10000 : VAL[piece[1]]);
const PIECE_NAMES: Record<Piece[1], string> = {
  k: "king",
  q: "queen",
  r: "rook",
  b: "bishop",
  n: "knight",
  p: "pawn",
};
const pieceName = (piece: Piece): string => PIECE_NAMES[piece[1]];

function pawnsOnFile(board: Position["board"], color: Color, file: number): number {
  let count = 0;
  for (let row = 0; row < 8; row += 1) if (board[idx(row, file)] === `${color}p`) count += 1;
  return count;
}

function isPassed(board: Position["board"], square: number): boolean {
  const piece = board[square]!;
  const color = piece[0] as Color,
    enemy: Color = color === "w" ? "b" : "w";
  const row = rowOf(square),
    col = colOf(square),
    direction = color === "w" ? -1 : 1;
  for (let rr = row + direction; rr >= 0 && rr < 8; rr += direction)
    for (const dc of [-1, 0, 1])
      if (inB(rr, col + dc) && board[idx(rr, col + dc)] === `${enemy}p`) return false;
  return true;
}

function isOutpost(board: Position["board"], square: number): boolean {
  const piece = board[square];
  if (!piece || piece[1] !== "n") return false;
  const color = piece[0] as Color,
    enemy: Color = color === "w" ? "b" : "w";
  const row = rowOf(square),
    col = colOf(square);
  if (!(color === "w" ? row <= 3 && row >= 1 : row >= 4 && row <= 6)) return false;
  const back = color === "w" ? row + 1 : row - 1;
  if (![-1, 1].some((dc) => inB(back, col + dc) && board[idx(back, col + dc)] === `${color}p`))
    return false;
  const direction = color === "w" ? -1 : 1;
  for (let rr = row + direction; rr >= 0 && rr < 8; rr += direction)
    for (const dc of [-1, 1])
      if (inB(rr, col + dc) && board[idx(rr, col + dc)] === `${enemy}p`) return false;
  return true;
}

export function structure(state: Position): Set<string> {
  const board = state.board,
    features = new Set<string>(),
    material = nonPawnMaterial(board);
  const endgame = material.w + material.b <= 1300;
  for (const color of ["w", "b"] as const) {
    const enemy: Color = color === "w" ? "b" : "w",
      home4 = color === "w" ? 4 : 3;
    if (board[idx(home4, 3)] === `${color}p` && board[idx(home4, 4)] === `${color}p`)
      features.add(`duo:${color}`);
    if (
      pawnsOnFile(board, color, 3) === 1 &&
      pawnsOnFile(board, color, 2) === 0 &&
      pawnsOnFile(board, color, 4) === 0
    )
      features.add(`iqp:${color}`);
    let doubled = 0,
      bishops = 0,
      enemyBishops = 0;
    for (let file = 0; file < 8; file += 1)
      doubled += Math.max(0, pawnsOnFile(board, color, file) - 1);
    if (doubled) features.add(`doubled:${color}:${doubled}`);
    for (let i = 0; i < 64; i += 1) {
      const piece = board[i];
      if (!piece) continue;
      if (piece === `${color}b`) bishops += 1;
      if (piece === `${enemy}b`) enemyBishops += 1;
      if (piece[0] !== color) continue;
      if (piece[1] === "p" && isPassed(board, i)) features.add(`passed:${color}:${sqName(i)}`);
      if (piece[1] === "n" && isOutpost(board, i)) features.add(`outpost:${color}:${sqName(i)}`);
      if (piece[1] === "r") {
        const file = colOf(i);
        if (pawnsOnFile(board, "w", file) === 0 && pawnsOnFile(board, "b", file) === 0)
          features.add(`openfile:${color}:${FILES[file]}`);
        if (rowOf(i) === (color === "w" ? 1 : 6)) features.add(`seventh:${color}`);
      }
      if (piece[1] === "k" && endgame) {
        const row = rowOf(i),
          col = colOf(i);
        if (row >= 2 && row <= 5 && col >= 2 && col <= 5) features.add(`activeking:${color}`);
      }
      if (piece[1] === "b") {
        const bishopSquares = color === "w" ? [idx(6, 6), idx(6, 1)] : [idx(1, 6), idx(1, 1)];
        const pawnSquares = color === "w" ? [idx(5, 6), idx(5, 1)] : [idx(2, 6), idx(2, 1)];
        bishopSquares.forEach((target, k) => {
          if (i === target && board[pawnSquares[k]] === `${color}p`)
            features.add(`fianchetto:${color}:${sqName(target)}`);
        });
      }
    }
    if (bishops === 2 && enemyBishops < 2) features.add(`bishops:${color}`);
    const minoritySquare = color === "w" ? idx(3, 1) : idx(4, 1),
      targetSquare = color === "w" ? idx(2, 2) : idx(5, 2);
    if (
      board[minoritySquare] === `${color}p` &&
      board[targetSquare] === `${enemy}p` &&
      pawnsOnFile(board, color, 2) === 0
    )
      features.add(`minority:${color}`);
  }
  const onlyKingsAndPawns = board.every((piece) => !piece || piece[1] === "p" || piece[1] === "k");
  if (onlyKingsAndPawns) {
    const whiteKing = kingSq(board, "w"),
      blackKing = kingSq(board, "b");
    const dr = Math.abs(rowOf(whiteKing) - rowOf(blackKing)),
      dc = Math.abs(colOf(whiteKing) - colOf(blackKing));
    if ((dr === 2 && dc === 0) || (dr === 0 && dc === 2))
      features.add(`opposition:${state.turn === "w" ? "b" : "w"}`);
  }
  return features;
}

export const MOTIF_ORDER: readonly MotifKey[] = [
  "doublecheck",
  "backrank",
  "fork",
  "discovered",
  "skewer",
  "pin",
  "sacrifice",
  "gambit",
  "underpromotion",
  "promotion",
  "enpassant",
  "castleQ",
  "castle",
  "fianchetto",
  "duo",
  "outpost",
  "seventh",
  "openfile",
  "passed",
  "bishops",
  "iqp",
  "doubled",
  "pawnbreak",
  "minority",
  "opposition",
  "activeking",
  "check",
];

export function detectMotifs(
  before: Position,
  move: Move,
  after: Position,
  over: GameResultLike | null,
): Motif[] {
  const found: Motif[] = [];
  const add = (key: MotifKey, detail: string, side: Color) => {
    if (!found.some((motif) => motif.key === key)) found.push({ key, detail, side });
  };
  const b0 = before.board,
    b1 = after.board,
    me = before.turn,
    enemy: Color = me === "w" ? "b" : "w";
  const moved = b1[move.to],
    to = sqName(move.to),
    enemyKing = kingSq(b1, enemy);
  const givesCheck = enemyKing >= 0 && isAttacked(b1, rowOf(enemyKing), colOf(enemyKing), me);
  if (move.castle === "K") add("castle", `${me === "w" ? "White" : "Black"} castles kingside.`, me);
  if (move.castle === "Q")
    add("castleQ", `${me === "w" ? "White" : "Black"} castles queenside.`, me);
  if (move.ep) add("enpassant", `Pawn captures en passant on ${to}.`, me);
  if (move.promo === "q") add("promotion", `Pawn promotes to a queen on ${to}.`, me);
  if (move.promo && move.promo !== "q")
    add(
      "underpromotion",
      `Pawn promotes to a ${{ r: "rook", b: "bishop", n: "knight" }[move.promo]} on ${to}.`,
      me,
    );
  let checkers: number[] = [];
  if (givesCheck) {
    checkers = attackersOf(b1, enemyKing, me);
    if (checkers.length >= 2)
      add("doublecheck", `Double check from ${checkers.map(sqName).join(" and ")}.`, me);
    if (over?.reason === "Checkmate") {
      const homeRow = enemy === "w" ? 7 : 0;
      const lineMate = checkers.some(
        (square) =>
          rowOf(square) === homeRow && (b1[square]?.[1] === "r" || b1[square]?.[1] === "q"),
      );
      if (rowOf(enemyKing) === homeRow && lineMate)
        add(
          "backrank",
          `Mate on the back rank with the ${b1[checkers[0]]?.[1] === "q" ? "queen" : "rook"}.`,
          me,
        );
    }
  }
  if (moved && moved[1] !== "k") {
    const targets = attacksFrom(b1, move.to).filter((square) => {
      const target = b1[square];
      return (
        !!target &&
        target[0] === enemy &&
        (target[1] === "k" ||
          pieceValue(target) > pieceValue(moved) ||
          attackersOf(b1, square, enemy).length === 0)
      );
    });
    if (targets.length >= 2 && targets.some((square) => pieceValue(b1[square]!) >= 300)) {
      const names = targets.map((square) => pieceName(b1[square]!));
      const moverName = ({ n: "Knight", b: "Bishop", r: "Rook", q: "Queen", p: "Pawn" } as const)[
        moved[1] as "n" | "b" | "r" | "q" | "p"
      ];
      add("fork", `${moverName} on ${to} forks the ${names.join(" and ")}.`, me);
    }
    if ("brq".includes(moved[1])) {
      const directions = moved[1] === "b" ? DIAG : moved[1] === "r" ? ORTH : [...DIAG, ...ORTH];
      for (const [dr, dc] of directions) {
        let rr = rowOf(move.to) + dr,
          cc = colOf(move.to) + dc,
          first: number | null = null,
          second: number | null = null;
        while (inB(rr, cc)) {
          const square = idx(rr, cc);
          if (b1[square]) {
            if (first === null) first = square;
            else {
              second = square;
              break;
            }
          }
          rr += dr;
          cc += dc;
        }
        if (
          first !== null &&
          second !== null &&
          b1[first]?.[0] === enemy &&
          b1[second]?.[0] === enemy
        ) {
          const front = b1[first]!,
            rear = b1[second]!;
          if (rear[1] === "k")
            add("pin", `The ${pieceName(front)} on ${sqName(first)} is pinned to the king.`, me);
          else if (front[1] === "k")
            add(
              "skewer",
              `Check on ${sqName(first)} skewers the ${pieceName(rear)} on ${sqName(second)}.`,
              me,
            );
          else if (pieceValue(rear) > pieceValue(front))
            add(
              "pin",
              `The ${pieceName(front)} on ${sqName(first)} is pinned to the ${pieceName(rear)}.`,
              me,
            );
          else if (pieceValue(front) > pieceValue(rear) && pieceValue(front) > pieceValue(moved))
            add(
              "skewer",
              `The ${pieceName(front)} on ${sqName(first)} is skewered against the ${pieceName(rear)}.`,
              me,
            );
        }
      }
    }
  }
  for (let square = 0; square < 64; square += 1) {
    const piece = b1[square];
    if (
      !piece ||
      piece[0] !== me ||
      !"brq".includes(piece[1]) ||
      square === move.to ||
      !attacksFrom(b0, square).includes(move.from)
    )
      continue;
    const dr = Math.sign(rowOf(move.from) - rowOf(square)),
      dc = Math.sign(colOf(move.from) - colOf(square));
    let rr = rowOf(move.from) + dr,
      cc = colOf(move.from) + dc;
    while (inB(rr, cc)) {
      const targetSquare = idx(rr, cc),
        target = b1[targetSquare];
      if (target) {
        if (target[0] === enemy && (target[1] === "k" || pieceValue(target) >= 500))
          add(
            "discovered",
            `Moving from ${sqName(move.from)} unmasks the ${pieceName(piece)} on ${sqName(square)} against the ${pieceName(target)} on ${sqName(targetSquare)}.`,
            me,
          );
        break;
      }
      rr += dr;
      cc += dc;
    }
  }
  if (moved && moved[1] !== "k") {
    const attackers = attackersOf(b1, move.to, enemy),
      defenders = attackersOf(b1, move.to, me);
    if (attackers.length) {
      const cheapest = Math.min(...attackers.map((square) => pieceValue(b1[square]!))),
        gained = move.capture ? VAL[move.capture[1]] : 0;
      const hanging = defenders.length === 0 || cheapest < pieceValue(moved),
        loss = pieceValue(moved) - gained - (defenders.length ? cheapest : 0);
      if (hanging && moved[1] === "p" && gained === 0 && before.fullmove <= 10)
        add("gambit", `A pawn is offered on ${to}.`, me);
      else if (hanging && loss >= 200)
        add(
          "sacrifice",
          `The ${pieceName(moved)} on ${to} is offered for ${gained ? "less material" : "nothing immediate"}: a sacrifice.`,
          me,
        );
    }
  }
  if (
    moved?.[1] === "p" &&
    !move.capture &&
    colOf(move.to) >= 2 &&
    colOf(move.to) <= 5 &&
    attacksFrom(b1, move.to).some((square) => b1[square] === `${enemy}p`)
  )
    add("pawnbreak", `The ${to} push challenges the enemy pawn chain.`, me);
  const beforeStructure = structure(before),
    afterStructure = structure(after);
  for (const tag of afterStructure) {
    if (beforeStructure.has(tag)) continue;
    const [rawKey, rawSide, argument] = tag.split(":"),
      key = rawKey as MotifKey,
      side = rawSide as Color,
      who = side === "w" ? "White" : "Black";
    if (key === "duo") add(key, `${who} has the classical pawn duo in the centre.`, side);
    if (key === "iqp") add(key, `${who} now has an isolated queen's pawn.`, side);
    if (key === "doubled" && side === enemy) add(key, `${who}'s pawns are doubled.`, side);
    if (key === "passed" && side === me) add(key, `${who} has a passed pawn on ${argument}.`, side);
    if (key === "outpost" && side === me)
      add(key, `Knight on ${argument} sits on an outpost.`, side);
    if (key === "openfile" && side === me)
      add(key, `${who}'s rook takes the open ${argument}-file.`, side);
    if (key === "seventh" && side === me) add(key, `${who}'s rook reaches the seventh rank.`, side);
    if (key === "bishops" && side === me) add(key, `${who} holds the bishop pair.`, side);
    if (key === "fianchetto" && side === me) add(key, `Bishop fianchettoed on ${argument}.`, side);
    if (key === "minority" && side === me) add(key, `${who} launches a minority attack.`, side);
    if (key === "opposition") add(key, `${who} takes the opposition.`, side);
    if (key === "activeking" && side === me) add(key, `${who}'s king marches to the centre.`, side);
  }
  if (
    givesCheck &&
    !found.some(({ key }) => key === "doublecheck" || key === "backrank") &&
    over?.reason !== "Checkmate"
  )
    add("check", `Check on the ${enemy === "w" ? "white" : "black"} king.`, me);
  found.sort((a, b) => MOTIF_ORDER.indexOf(a.key) - MOTIF_ORDER.indexOf(b.key));
  return found.slice(0, 3);
}
