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
import { rosterBookKey } from "../../src/engine/roster/book";
import type { Color, Move, PieceKind, Position } from "../../src/engine/types";

export interface RosterGame {
  id: string;
  white: string;
  black: string;
  date: string;
  site: string;
  rosterColor: Color;
  moves: string[];
}

export type RosterBook = Record<string, Array<[uci: string, count: number]>>;

interface ParsedRecord {
  tags: Record<string, string>;
  moveText: string;
  error?: string;
}

const TAG = /\[([A-Za-z][A-Za-z0-9_]*)\s+"((?:\\.|[^"\\])*)"\s*\]/gs;
const RESULT = /^(?:1-0|0-1|1\/2(?:-1\/2)?|\*)$/;

function splitRecords(text: string): string[] {
  const normalized = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replaceAll(String.fromCharCode(26), "");
  return normalized
    .trim()
    .split(/\n[ \t]*\n(?=[ \t]*\[[A-Za-z])/g)
    .map((record) => record.trim())
    .filter(Boolean);
}

function parseRecord(record: string): ParsedRecord {
  const tags: Record<string, string> = {};
  let rest = record.trim();
  while (rest.startsWith("[")) {
    const match = new RegExp(`^${TAG.source}`, "s").exec(rest);
    if (!match) return { tags, moveText: rest, error: "malformed header" };
    if (Object.hasOwn(tags, match[1]))
      return { tags, moveText: rest, error: "duplicate header tag" };
    tags[match[1]] = match[2]
      .replace(/\\([\\"])/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
    rest = rest.slice(match[0].length).trimStart();
  }
  return { tags, moveText: rest };
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
    .filter((token) => token && token !== "...");
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
  // Filter by destination/kind before generating SAN: avoids quadratic full-board
  // notation generation while still validating canonical SAN and disambiguation.
  const target = wanted.match(/([a-h][1-8])(?:=[QRBN])?$/)?.[1];
  const kind = /^[KQRBN]/.test(wanted) ? wanted[0].toLowerCase() : "p";
  const shortlist = target
    ? legal.filter((m) => m.to === sqIndex(target) && position.board[m.from]?.[1] === kind)
    : legal;
  const candidates = shortlist.filter(
    (move) => normalizedSan(sanFor(position, move, applyMove(position, move))) === wanted,
  );
  return candidates.length === 1 ? candidates[0] : null;
}

function gameId(rosterColor: Color, moves: string[]): string {
  return createHash("sha256")
    .update(`${rosterColor}\n${moves.join(" ")}`)
    .digest("hex");
}

export function parseRosterPgn(
  text: string,
  identity: string | readonly string[],
): {
  games: RosterGame[];
  excluded: Array<{ index: number; reason: string }>;
} {
  const games: RosterGame[] = [];
  const excluded: Array<{ index: number; reason: string }> = [];
  const seen = new Set<string>();

  for (const [recordIndex, raw] of splitRecords(text).entries()) {
    const index = recordIndex + 1;
    const { tags, moveText, error } = parseRecord(raw);
    const reject = (reason: string) => excluded.push({ index, reason });

    if (error) {
      reject(error);
      continue;
    }
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
    if (
      Object.entries(tags).some(
        ([key, value]) =>
          (key === "Variant" && value !== "Standard") ||
          /\b(consultation|consulting)\b/i.test(value),
      )
    ) {
      reject("nonordinary variant or consultation game");
      continue;
    }
    if (
      !tags.White ||
      !tags.Black ||
      tags.White === tags.Black ||
      /[&/+]/.test(tags.White + tags.Black)
    ) {
      reject("missing or ambiguous player identity");
      continue;
    }
    const names = typeof identity === "string" ? [identity] : identity;
    if (names.includes(tags.White) && names.includes(tags.Black)) {
      reject("both participants match the roster identity");
      continue;
    }
    const rosterColor = names.includes(tags.White) ? "w" : names.includes(tags.Black) ? "b" : null;
    if (!rosterColor) {
      reject(`player name is not exactly "${identity}"`);
      continue;
    }

    let position = START();
    const moves: string[] = [];
    const tokens = moveTokens(moveText);
    if (!tokens) {
      reject("unterminated comment or variation");
      continue;
    }
    if (
      !RESULT.test(tags.Result ?? "") ||
      tokens.at(-1) !== tags.Result ||
      tokens.slice(0, -1).some((token) => RESULT.test(token))
    ) {
      reject("missing, mismatched or nonfinal game result");
      continue;
    }
    tokens.pop();
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

    const id = gameId(rosterColor, moves);
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
      rosterColor,
      moves,
    });
  }

  return { games, excluded };
}

export function replayRosterGame(game: RosterGame): Move[] {
  let position = START();
  return game.moves.map((san, index) => {
    const move = resolveMove(position, san);
    if (!move) throw new Error(`Roster game ${game.id} is illegal at ply ${index + 1}: ${san}`);
    position = applyMove(position, move);
    return move;
  });
}

export function buildRosterBook(games: RosterGame[]): RosterBook {
  const counts = new Map<string, Map<string, number>>();
  const fullKeys = new Map<string, string>();
  for (const game of games) {
    let position = START();
    for (const move of replayRosterGame(game)) {
      if (position.turn === game.rosterColor) {
        const key = rosterBookKey(position);
        const full = posKey(position);
        if (fullKeys.has(key) && fullKeys.get(key) !== full)
          throw new Error("Compact book key collision");
        fullKeys.set(key, full);
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

export function assertRosterBookLegal(book: RosterBook, games: RosterGame[]): void {
  const positions = new Map<string, Position>();
  for (const game of games) {
    let position = START();
    for (const move of replayRosterGame(game)) {
      if (position.turn === game.rosterColor) positions.set(rosterBookKey(position), position);
      position = applyMove(position, move);
    }
  }

  for (const [key, continuations] of Object.entries(book)) {
    const position = positions.get(key);
    if (!position) throw new Error("Roster book contains a position absent from the corpus");
    const legalUci = new Set(
      legalMoves(position).map(
        (move) => `${sqName(move.from)}${sqName(move.to)}${move.promo ?? ""}`,
      ),
    );
    for (const [uci, count] of continuations) {
      if (!legalUci.has(uci)) throw new Error(`Roster book contains illegal continuation ${uci}`);
      if (!Number.isSafeInteger(count) || count < 1)
        throw new Error(`Roster book contains invalid count for ${uci}`);
    }
  }
}
