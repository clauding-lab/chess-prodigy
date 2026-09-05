import type { Color, Move, Piece, PieceKind, Position } from "./types";

export const idx = (row: number, col: number): number => row * 8 + col;
export const rowOf = (square: number): number => Math.floor(square / 8);
export const colOf = (square: number): number => square % 8;
export const inB = (row: number, col: number): boolean =>
  row >= 0 && row < 8 && col >= 0 && col < 8;
export const FILES = "abcdefgh";
export const sqName = (square: number): string => `${FILES[colOf(square)]}${8 - rowOf(square)}`;
export const sqIndex = (name: string): number => {
  if (!/^[a-h][1-8]$/.test(name)) throw new Error(`Invalid square: ${name}`);
  return idx(8 - Number(name[1]), FILES.indexOf(name[0]));
};

export const KN: ReadonlyArray<readonly [number, number]> = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
];
export const KG: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];
export const DIAG: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];
export const ORTH: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

const opposite = (color: Color): Color => (color === "w" ? "b" : "w");
const kind = (piece: Piece): PieceKind => piece[1] as PieceKind;

export function START(): Position {
  const board: (Piece | null)[] = new Array<Piece | null>(64).fill(null);
  const back: PieceKind[] = ["r", "n", "b", "q", "k", "b", "n", "r"];
  for (let col = 0; col < 8; col++) {
    board[idx(0, col)] = `b${back[col]}`;
    board[idx(1, col)] = "bp";
    board[idx(6, col)] = "wp";
    board[idx(7, col)] = `w${back[col]}`;
  }
  return {
    board,
    turn: "w",
    castling: { K: true, Q: true, k: true, q: true },
    ep: null,
    halfmove: 0,
    fullmove: 1,
  };
}

export function isAttacked(board: Position["board"], row: number, col: number, by: Color): boolean {
  const pawnRow = by === "w" ? row + 1 : row - 1;
  for (const dc of [-1, 1])
    if (inB(pawnRow, col + dc) && board[idx(pawnRow, col + dc)] === `${by}p`) return true;
  for (const [dr, dc] of KN)
    if (inB(row + dr, col + dc) && board[idx(row + dr, col + dc)] === `${by}n`) return true;
  for (const [dr, dc] of KG)
    if (inB(row + dr, col + dc) && board[idx(row + dr, col + dc)] === `${by}k`) return true;
  for (const [dr, dc] of ORTH) {
    let r = row + dr,
      c = col + dc;
    while (inB(r, c)) {
      const piece = board[idx(r, c)];
      if (piece) {
        if (piece[0] === by && (kind(piece) === "r" || kind(piece) === "q")) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }
  for (const [dr, dc] of DIAG) {
    let r = row + dr,
      c = col + dc;
    while (inB(r, c)) {
      const piece = board[idx(r, c)];
      if (piece) {
        if (piece[0] === by && (kind(piece) === "b" || kind(piece) === "q")) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }
  return false;
}

export function kingSq(board: Position["board"], color: Color): number {
  return board.indexOf(`${color}k`);
}

export function inCheck(position: Position, color: Color): boolean {
  const square = kingSq(position.board, color);
  return square >= 0 && isAttacked(position.board, rowOf(square), colOf(square), opposite(color));
}

export function genPseudo(position: Position): Move[] {
  const { board, turn, castling, ep } = position;
  const moves: Move[] = [],
    enemy = opposite(turn);
  for (let from = 0; from < 64; from++) {
    const piece = board[from];
    if (!piece || piece[0] !== turn) continue;
    const row = rowOf(from),
      col = colOf(from),
      type = kind(piece);
    if (type === "p") {
      const dir = turn === "w" ? -1 : 1,
        startRow = turn === "w" ? 6 : 1,
        promotionRow = turn === "w" ? 0 : 7;
      const nextRow = row + dir;
      if (inB(nextRow, col)) {
        const one = idx(nextRow, col);
        if (!board[one]) {
          if (nextRow === promotionRow)
            for (const promo of ["q", "r", "b", "n"] as const) moves.push({ from, to: one, promo });
          else {
            moves.push({ from, to: one });
            const two = idx(row + 2 * dir, col);
            if (row === startRow && !board[two]) moves.push({ from, to: two, double: true });
          }
        }
      }
      for (const dc of [-1, 1]) {
        if (!inB(nextRow, col + dc)) continue;
        const to = idx(nextRow, col + dc),
          target = board[to];
        if (target && target[0] === enemy) {
          if (nextRow === promotionRow)
            for (const promo of ["q", "r", "b", "n"] as const)
              moves.push({ from, to, promo, capture: target });
          else moves.push({ from, to, capture: target });
        } else if (to === ep) moves.push({ from, to, ep: true, capture: `${enemy}p` });
      }
    } else if (type === "n" || type === "k") {
      for (const [dr, dc] of type === "n" ? KN : KG) {
        if (!inB(row + dr, col + dc)) continue;
        const to = idx(row + dr, col + dc),
          target = board[to];
        if (!target) moves.push({ from, to });
        else if (target[0] === enemy) moves.push({ from, to, capture: target });
      }
      if (type === "k") {
        const home = turn === "w" ? 7 : 0;
        const kingside = turn === "w" ? "K" : "k",
          queenside = turn === "w" ? "Q" : "q";
        if (row === home && col === 4 && !isAttacked(board, home, 4, enemy)) {
          if (
            castling[kingside] &&
            !board[idx(home, 5)] &&
            !board[idx(home, 6)] &&
            board[idx(home, 7)] === `${turn}r` &&
            !isAttacked(board, home, 5, enemy) &&
            !isAttacked(board, home, 6, enemy)
          )
            moves.push({ from, to: idx(home, 6), castle: "K" });
          if (
            castling[queenside] &&
            !board[idx(home, 3)] &&
            !board[idx(home, 2)] &&
            !board[idx(home, 1)] &&
            board[idx(home, 0)] === `${turn}r` &&
            !isAttacked(board, home, 3, enemy) &&
            !isAttacked(board, home, 2, enemy)
          )
            moves.push({ from, to: idx(home, 2), castle: "Q" });
        }
      }
    } else {
      const directions = type === "b" ? DIAG : type === "r" ? ORTH : [...DIAG, ...ORTH];
      for (const [dr, dc] of directions) {
        let r = row + dr,
          c = col + dc;
        while (inB(r, c)) {
          const to = idx(r, c),
            target = board[to];
          if (!target) moves.push({ from, to });
          else {
            if (target[0] === enemy) moves.push({ from, to, capture: target });
            break;
          }
          r += dr;
          c += dc;
        }
      }
    }
  }
  return moves;
}

export function applyMove(position: Position, move: Move): Position {
  const board = position.board.slice(),
    piece = board[move.from];
  if (!piece || piece[0] !== position.turn) throw new Error("Move has no moving piece");
  const turn = position.turn,
    enemy = opposite(turn),
    fromRow = rowOf(move.from),
    fromCol = colOf(move.from),
    toRow = rowOf(move.to),
    toCol = colOf(move.to);
  board[move.to] = move.promo ? `${turn}${move.promo}` : piece;
  board[move.from] = null;
  if (move.ep) board[idx(fromRow, toCol)] = null;
  if (move.castle === "K") {
    board[idx(fromRow, 5)] = board[idx(fromRow, 7)];
    board[idx(fromRow, 7)] = null;
  }
  if (move.castle === "Q") {
    board[idx(fromRow, 3)] = board[idx(fromRow, 0)];
    board[idx(fromRow, 0)] = null;
  }
  const castling = { ...position.castling };
  if (piece === "wk") {
    castling.K = false;
    castling.Q = false;
  }
  if (piece === "bk") {
    castling.k = false;
    castling.q = false;
  }
  if (move.from === 63 || move.to === 63) castling.K = false;
  if (move.from === 56 || move.to === 56) castling.Q = false;
  if (move.from === 7 || move.to === 7) castling.k = false;
  if (move.from === 0 || move.to === 0) castling.q = false;
  return {
    board,
    turn: enemy,
    castling,
    ep: move.double ? idx((fromRow + toRow) / 2, fromCol) : null,
    halfmove: kind(piece) === "p" || move.capture ? 0 : position.halfmove + 1,
    fullmove: turn === "b" ? position.fullmove + 1 : position.fullmove,
  };
}

export function legalFilter(position: Position, moves: Move[]): Move[] {
  const enemy = opposite(position.turn),
    initialKing = kingSq(position.board, position.turn);
  return moves.filter((move) => {
    const next = applyMove(position, move);
    const moving = position.board[move.from];
    const king = moving && kind(moving) === "k" ? move.to : initialKing;
    return king >= 0 && !isAttacked(next.board, rowOf(king), colOf(king), enemy);
  });
}
export const legalMoves = (position: Position): Move[] =>
  legalFilter(position, genPseudo(position));

export function posKey(position: Position): string {
  const c = position.castling;
  const legalEp =
    position.ep !== null &&
    legalFilter(
      position,
      genPseudo(position).filter((move) => move.ep),
    ).length > 0;
  return (
    position.board.map((piece) => piece ?? ".").join("") +
    position.turn +
    (c.K ? "K" : "") +
    (c.Q ? "Q" : "") +
    (c.k ? "k" : "") +
    (c.q ? "q" : "") +
    (legalEp ? sqName(position.ep!) : "-")
  );
}

export function toFEN(position: Position): string {
  const ranks: string[] = [];
  for (let row = 0; row < 8; row++) {
    let rank = "",
      empty = 0;
    for (let col = 0; col < 8; col++) {
      const piece = position.board[idx(row, col)];
      if (!piece) empty++;
      else {
        if (empty) {
          rank += empty;
          empty = 0;
        }
        rank += piece[0] === "w" ? kind(piece).toUpperCase() : kind(piece);
      }
    }
    if (empty) rank += empty;
    ranks.push(rank);
  }
  const rights =
    (position.castling.K ? "K" : "") +
    (position.castling.Q ? "Q" : "") +
    (position.castling.k ? "k" : "") +
    (position.castling.q ? "q" : "");
  return `${ranks.join("/")} ${position.turn} ${rights || "-"} ${position.ep === null ? "-" : sqName(position.ep)} ${position.halfmove} ${position.fullmove}`;
}

export function fromFEN(fen: string): Position {
  const fields = fen.trim().split(/\s+/);
  if (fields.length !== 6) throw new Error("FEN must contain six fields");
  const [placement, turnText, rightsText, epText, halfText, fullText] = fields;
  if (turnText !== "w" && turnText !== "b") throw new Error("Invalid active colour");
  const ranks = placement.split("/");
  if (ranks.length !== 8) throw new Error("FEN must contain eight ranks");
  const board: (Piece | null)[] = [];
  for (const rank of ranks) {
    let count = 0;
    for (const symbol of rank) {
      if (/^[1-8]$/.test(symbol)) {
        const empty = Number(symbol);
        board.push(...new Array<null>(empty).fill(null));
        count += empty;
      } else if (/^[prnbqkPRNBQK]$/.test(symbol)) {
        board.push(
          `${symbol === symbol.toUpperCase() ? "w" : "b"}${symbol.toLowerCase() as PieceKind}`,
        );
        count++;
      } else throw new Error("Unknown FEN piece");
    }
    if (count !== 8) throw new Error("Each rank must contain eight squares");
  }
  if (board.filter((p) => p === "wk").length !== 1 || board.filter((p) => p === "bk").length !== 1)
    throw new Error("Position must have one king per colour");
  const whiteKing = kingSq(board, "w"),
    blackKing = kingSq(board, "b");
  if (
    Math.abs(rowOf(whiteKing) - rowOf(blackKing)) <= 1 &&
    Math.abs(colOf(whiteKing) - colOf(blackKing)) <= 1
  )
    throw new Error("Kings cannot be adjacent");
  if (
    board
      .slice(0, 8)
      .concat(board.slice(56))
      .some((p) => p?.[1] === "p")
  )
    throw new Error("Pawn on terminal rank");
  if (
    rightsText !== "-" &&
    (!/^[KQkq]+$/.test(rightsText) || new Set(rightsText).size !== rightsText.length)
  )
    throw new Error("Invalid castling rights");
  const castling = {
    K: rightsText.includes("K"),
    Q: rightsText.includes("Q"),
    k: rightsText.includes("k"),
    q: rightsText.includes("q"),
  };
  if (
    (castling.K && (board[60] !== "wk" || board[63] !== "wr")) ||
    (castling.Q && (board[60] !== "wk" || board[56] !== "wr")) ||
    (castling.k && (board[4] !== "bk" || board[7] !== "br")) ||
    (castling.q && (board[4] !== "bk" || board[0] !== "br"))
  )
    throw new Error("Castling pieces are inconsistent");
  let ep: number | null = null;
  if (epText !== "-") {
    if (!/^[a-h][36]$/.test(epText)) throw new Error("Invalid en-passant square");
    ep = sqIndex(epText);
    const expectedRank = turnText === "w" ? "6" : "3";
    if (epText[1] !== expectedRank) throw new Error("En-passant rank contradicts active colour");
    const pawnSquare = ep + (turnText === "w" ? 8 : -8);
    if (board[ep] !== null || board[pawnSquare] !== `${opposite(turnText)}p`)
      throw new Error("Impossible en-passant structure");
  }
  if (!/^\d+$/.test(halfText) || !/^\d+$/.test(fullText)) throw new Error("Invalid move counters");
  const halfmove = Number(halfText),
    fullmove = Number(fullText);
  if (!Number.isSafeInteger(halfmove) || !Number.isSafeInteger(fullmove) || fullmove < 1)
    throw new Error("Invalid move counters");
  return { board, turn: turnText, castling, ep, halfmove, fullmove };
}

export function insufficientMaterial(board: Position["board"]): boolean {
  const minors: Array<{ piece: Piece; square: number }> = [];
  for (let square = 0; square < 64; square++) {
    const piece = board[square];
    if (!piece || kind(piece) === "k") continue;
    if (kind(piece) === "b" || kind(piece) === "n") minors.push({ piece, square });
    else return false;
  }
  if (minors.length <= 1) return true;
  return (
    minors.length === 2 &&
    minors.every(({ piece }) => kind(piece) === "b") &&
    minors[0].piece[0] !== minors[1].piece[0] &&
    (rowOf(minors[0].square) + colOf(minors[0].square)) % 2 ===
      (rowOf(minors[1].square) + colOf(minors[1].square)) % 2
  );
}

export function sanFor(position: Position, move: Move, next: Position): string {
  const decorate = (base: string): string =>
    inCheck(next, next.turn) ? base + (legalMoves(next).length === 0 ? "#" : "+") : base;
  if (move.castle === "K") return decorate("O-O");
  if (move.castle === "Q") return decorate("O-O-O");
  const piece = position.board[move.from];
  if (!piece) throw new Error("Move has no piece");
  const type = kind(piece);
  const letters: Record<PieceKind, string> = { p: "", n: "N", b: "B", r: "R", q: "Q", k: "K" };
  let disambiguation = "";
  if (type !== "p" && type !== "k") {
    const rivals = legalMoves(position).filter(
      (candidate) =>
        candidate.to === move.to &&
        candidate.from !== move.from &&
        position.board[candidate.from] === piece,
    );
    if (rivals.length) {
      const sameFile = rivals.some((candidate) => colOf(candidate.from) === colOf(move.from));
      const sameRank = rivals.some((candidate) => rowOf(candidate.from) === rowOf(move.from));
      disambiguation = !sameFile
        ? FILES[colOf(move.from)]
        : !sameRank
          ? String(8 - rowOf(move.from))
          : sqName(move.from);
    }
  }
  let san = letters[type] + disambiguation;
  if (move.capture) san += (type === "p" ? FILES[colOf(move.from)] : "") + "x";
  san += sqName(move.to);
  if (move.promo) san += `=${move.promo.toUpperCase()}`;
  return decorate(san);
}

export function sameMove(a: Move | null | undefined, b: Move | null | undefined): boolean {
  return Boolean(
    a && b && a.from === b.from && a.to === b.to && (a.promo ?? null) === (b.promo ?? null),
  );
}
