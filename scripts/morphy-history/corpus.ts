import { createHash } from "node:crypto";
import {
  START,
  applyMove,
  legalMoves,
  posKey,
  sanFor,
  sqIndex,
  sqName,
} from "../../src/engine/board";
import type { Color, Move, PieceKind, Position } from "../../src/engine/types";

export interface HistoricalGame {
  id: string;
  white: string;
  black: string;
  date: string;
  site: string;
  morphyColor: Color;
  moves: string[];
}

export type HistoricalBook = Record<string, Array<[uci: string, count: number]>>;

interface ParsedRecord {
  tags: Record<string, string>;
  moveText: string;
}

const TAG = /\[([A-Za-z][A-Za-z0-9_]*)\s+"((?:\\.|[^"\\])*)"\s*\]/gs;
const RESULT = /^(?:1-0|0-1|1\/2(?:-1\/2)?|\*)$/;

function splitRecords(text: string): string[] {
  const normalized = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u001a/g, "");
  return normalized
    .trim()
    .split(/\n[ \t]*\n(?=[ \t]*\[[A-Za-z])/g)
    .map((record) => record.trim())
    .filter(Boolean);
}

function parseRecord(record: string): ParsedRecord {
  const tags: Record<string, string> = {};
  for (const match of record.matchAll(TAG)) {
    tags[match[1]] = match[2]
      .replace(/\\([\\"])/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  }
  return { tags, moveText: record.replace(TAG, " ") };
}

function stripAnnotations(text: string): string | null {
  let output = "";
  let braceDepth = 0;
  let variationDepth = 0;
  let lineComment = false;
  for (const character of text) {
    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (braceDepth) {
      if (character === "{") braceDepth++;
      else if (character === "}") braceDepth--;
      continue;
    }
    if (variationDepth) {
      if (character === "(") variationDepth++;
      else if (character === ")") variationDepth--;
      continue;
    }
    if (character === ";") lineComment = true;
    else if (character === "{") braceDepth = 1;
    else if (character === "(") variationDepth = 1;
    else output += character;
  }
  return braceDepth || variationDepth ? null : output;
}

function moveTokens(moveText: string): string[] | null {
  const stripped = stripAnnotations(moveText);
  if (stripped === null) return null;
  return stripped
    .replace(/\$\d+/g, " ")
    .replace(/\b\d+\.(?:\.\.)?/g, " ")
    .split(/\s+/)
    .map((token) => token.trim().replace(/[!?]+$/g, ""))
    .filter((token) => token && token !== "..." && !RESULT.test(token));
}

function normalizedSan(san: string): string {
  return san
    .replace(/^0-0-0/, "O-O-O")
    .replace(/^0-0/, "O-O")
    .replace(/([a-h][18])([QRBN])(?=[+#]*$)/, "$1=$2")
    .replace(/[+#]+$/g, "");
}

function resolveMove(position: Position, token: string): Move | null {
  const cleaned = token.replace(/(?:e\.?p\.?)$/i, "").replace(/[!?]+$/g, "");
  const coordinate = cleaned.match(
    /^([KQRBN])?([a-h][1-8])([-x:]?)([a-h][1-8])(?:=?([QRBN]))?[+#]*$/,
  );
  const legal = legalMoves(position);
  if (coordinate) {
    const [, pieceLetter, fromName, separator, toName, promotion] = coordinate;
    const from = sqIndex(fromName);
    const to = sqIndex(toName);
    const expectedKind = pieceLetter?.toLowerCase() as PieceKind | undefined;
    const candidates = legal.filter((move) => {
      const piece = position.board[move.from];
      return (
        move.from === from &&
        move.to === to &&
        (move.promo ?? null) === (promotion?.toLowerCase() ?? null) &&
        (!expectedKind || piece?.[1] === expectedKind) &&
        (separator !== "x" || Boolean(move.capture)) &&
        (separator !== "-" || !move.capture)
      );
    });
    return candidates.length === 1 ? candidates[0] : null;
  }

  const wanted = normalizedSan(cleaned);
  const candidates = legal.filter(
    (move) => normalizedSan(sanFor(position, move, applyMove(position, move))) === wanted,
  );
  return candidates.length === 1 ? candidates[0] : null;
}

function gameId(morphyColor: Color, moves: string[]): string {
  return createHash("sha256")
    .update(`${morphyColor}\n${moves.join(" ")}`)
    .digest("hex");
}

export function parseHistoricalPgn(text: string): {
  games: HistoricalGame[];
  excluded: Array<{ index: number; reason: string }>;
} {
  const games: HistoricalGame[] = [];
  const excluded: Array<{ index: number; reason: string }> = [];
  const seen = new Set<string>();

  for (const [recordIndex, raw] of splitRecords(text).entries()) {
    const index = recordIndex + 1;
    const { tags, moveText } = parseRecord(raw);
    const reject = (reason: string) => excluded.push({ index, reason });

    if (
      Object.entries(tags).some(
        ([key, value]) => key.toLowerCase() === "odds" || /\bodds?\b/i.test(value),
      )
    ) {
      reject("odds game");
      continue;
    }
    if (Object.hasOwn(tags, "SetUp") || Object.hasOwn(tags, "FEN")) {
      reject("setup or FEN position");
      continue;
    }
    const morphyColor = tags.White === "Morphy" ? "w" : tags.Black === "Morphy" ? "b" : null;
    if (!morphyColor) {
      reject('player name is not exactly "Morphy"');
      continue;
    }

    let position = START();
    const moves: string[] = [];
    const tokens = moveTokens(moveText);
    if (!tokens) {
      reject("unterminated comment or variation");
      continue;
    }
    let badMove: { ply: number; token: string } | null = null;
    for (const [tokenIndex, token] of tokens.entries()) {
      const move = resolveMove(position, token);
      if (!move) {
        badMove = { ply: tokenIndex + 1, token };
        break;
      }
      const next = applyMove(position, move);
      moves.push(sanFor(position, move, next));
      position = next;
    }
    if (badMove) {
      reject(`illegal or unsupported move at ply ${badMove.ply}: "${badMove.token}"`);
      continue;
    }
    if (!moves.length) {
      reject("record has no legal moves");
      continue;
    }

    const id = gameId(morphyColor, moves);
    if (seen.has(id)) {
      reject(`exact duplicate of ${id}`);
      continue;
    }
    seen.add(id);
    games.push({
      id,
      white: tags.White ?? "",
      black: tags.Black ?? "",
      date: tags.Date ?? "",
      site: tags.Site ?? "",
      morphyColor,
      moves,
    });
  }

  return { games, excluded };
}

export function replayHistoricalGame(game: HistoricalGame): Move[] {
  let position = START();
  return game.moves.map((san, index) => {
    const move = resolveMove(position, san);
    if (!move) throw new Error(`Historical game ${game.id} is illegal at ply ${index + 1}: ${san}`);
    position = applyMove(position, move);
    return move;
  });
}

export function buildHistoricalBook(games: HistoricalGame[]): HistoricalBook {
  const counts = new Map<string, Map<string, number>>();
  for (const game of games) {
    let position = START();
    for (const move of replayHistoricalGame(game)) {
      if (position.turn === game.morphyColor) {
        const key = posKey(position);
        const uci = `${sqName(move.from)}${sqName(move.to)}${move.promo ?? ""}`;
        const continuations = counts.get(key) ?? new Map<string, number>();
        continuations.set(uci, (continuations.get(uci) ?? 0) + 1);
        counts.set(key, continuations);
      }
      position = applyMove(position, move);
    }
  }

  return Object.fromEntries(
    [...counts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, continuations]) => [
        key,
        [...continuations.entries()].sort(
          ([leftMove, leftCount], [rightMove, rightCount]) =>
            rightCount - leftCount || leftMove.localeCompare(rightMove),
        ),
      ]),
  );
}

export function assertHistoricalBookLegal(book: HistoricalBook, games: HistoricalGame[]): void {
  const positions = new Map<string, Position>();
  for (const game of games) {
    let position = START();
    for (const move of replayHistoricalGame(game)) {
      if (position.turn === game.morphyColor) positions.set(posKey(position), position);
      position = applyMove(position, move);
    }
  }

  for (const [key, continuations] of Object.entries(book)) {
    const position = positions.get(key);
    if (!position) throw new Error("Historical book contains a position absent from the corpus");
    const legalUci = new Set(
      legalMoves(position).map(
        (move) => `${sqName(move.from)}${sqName(move.to)}${move.promo ?? ""}`,
      ),
    );
    for (const [uci, count] of continuations) {
      if (!legalUci.has(uci))
        throw new Error(`Historical book contains illegal continuation ${uci}`);
      if (!Number.isSafeInteger(count) || count < 1)
        throw new Error(`Historical book contains invalid count for ${uci}`);
    }
  }
}
