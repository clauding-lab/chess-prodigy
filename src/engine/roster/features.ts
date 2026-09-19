import { applyMove, inCheck, kingSq, legalMoves } from "../board";
import type { Color, Move, Position } from "../types";
export const enemy = (s: Color): Color => (s === "w" ? "b" : "w");
export const home = (s: Color) => (s === "w" ? 7 : 0);
export const value: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const inside = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
export function sideMoves(p: Position, s: Color): Move[] {
  return legalMoves({ ...p, turn: s, ep: p.turn === s ? p.ep : null }).filter(
    (m) => m.capture?.[1] !== "k",
  );
}
export function pawnSupported(p: Position, s: Color, sq: number) {
  const r = (sq >> 3) + (s === "w" ? 1 : -1);
  return [-1, 1].some(
    (dc) => inside(r, (sq & 7) + dc) && p.board[r * 8 + (sq & 7) + dc] === `${s}p`,
  );
}
export interface Features {
  homeMinors: number;
  lines: number;
  bishops: number;
  attackers: number;
  area: number;
  exposure: number;
  safeKing: boolean;
  material: number;
  nonPawn: number;
  pressure: number;
  files: number;
  passed: number;
  kingActivity: number;
  mobility: Map<number, number>;
}
/** All reach is legal, including pinned sliding pieces. King-zone reach counts distinct pieces. */
export function features(p: Position, s: Color): Features {
  const k = kingSq(p.board, s),
    ek = kingSq(p.board, enemy(s)),
    moves = sideMoves(p, s),
    mobility = new Map<number, number>(),
    attackers = new Set<number>(),
    area = new Set<number>(),
    pressure = new Set<number>();
  let lines = 0,
    bishops = 0,
    homeMinors = 0,
    material = 0,
    nonPawn = 0,
    files = 0,
    passed = 0;
  for (const m of moves) {
    const kind = p.board[m.from]![1];
    mobility.set(m.from, (mobility.get(m.from) ?? 0) + 1);
    if (
      "nbrq".includes(kind) &&
      Math.max(Math.abs((m.to >> 3) - (ek >> 3)), Math.abs((m.to & 7) - (ek & 7))) <= 1
    ) {
      attackers.add(m.from);
      area.add(m.to);
    }
    if (m.capture?.[1] === "p" && !pawnSupported(p, enemy(s), m.to)) pressure.add(m.to);
  }
  for (let sq = 0; sq < 64; sq++) {
    const piece = p.board[sq];
    if (!piece) continue;
    material += (piece[0] === s ? 1 : -1) * value[piece[1]];
    if (piece[0] !== s) continue;
    const kind = piece[1],
      reach = mobility.get(sq) ?? 0;
    if (kind !== "p") nonPawn += value[kind];
    if ("bn".includes(kind) && sq >> 3 === home(s)) homeMinors++;
    if ("brq".includes(kind)) lines += Math.min(10, reach);
    if (kind === "b") bishops += Math.min(12, reach);
    if (kind === "r" && reach > 0 && !p.board.some((x, i) => x === `${s}p` && (i & 7) === (sq & 7)))
      files += p.board.some((x, i) => x === `${enemy(s)}p` && (i & 7) === (sq & 7)) ? 1 : 2;
    if (kind === "p") {
      const rank = s === "w" ? 7 - (sq >> 3) : sq >> 3;
      const blocked = p.board.some(
        (x, i) =>
          x === `${enemy(s)}p` &&
          Math.abs((i & 7) - (sq & 7)) <= 1 &&
          (s === "w" ? i >> 3 < sq >> 3 : i >> 3 > sq >> 3),
      );
      if (!blocked) {
        const near = Math.max(Math.abs((k >> 3) - (sq >> 3)), Math.abs((k & 7) - (sq & 7))) <= 1;
        passed += rank * (pawnSupported(p, s, sq) || near ? 2 : 1);
      }
    }
  }
  const shield = (side: Color, king: number) =>
    [-1, 0, 1].filter((dc) => {
      const r = (king >> 3) + (side === "w" ? -1 : 1),
        c = (king & 7) + dc;
      return inside(r, c) && p.board[r * 8 + c] === `${side}p`;
    }).length;
  return {
    homeMinors,
    lines,
    bishops,
    attackers: attackers.size,
    area: area.size,
    exposure: 3 - shield(enemy(s), ek),
    safeKing:
      !inCheck(p, s) && shield(s, k) >= 2 && k >> 3 === home(s) && [1, 2, 6].includes(k & 7),
    material,
    nonPawn,
    pressure: pressure.size,
    files,
    passed,
    kingActivity: 7 - Math.max(Math.abs((k >> 3) - 3.5), Math.abs((k & 7) - 3.5)),
    mobility,
  };
}
export function centralBreak(p: Position, m: Move, before: Features, after: Features): boolean {
  if (
    p.board[m.from]?.[1] !== "p" ||
    (m.to & 7) < 2 ||
    (m.to & 7) > 5 ||
    m.to >> 3 < 2 ||
    m.to >> 3 > 5
  )
    return false;
  const next = applyMove(p, m),
    r = (m.to >> 3) + (p.turn === "w" ? -1 : 1);
  const contact =
    Boolean(m.capture) ||
    [-1, 1].some(
      (dc) =>
        inside(r, (m.to & 7) + dc) && next.board[r * 8 + (m.to & 7) + dc] === `${enemy(p.turn)}p`,
    );
  return (
    contact &&
    (after.lines > before.lines ||
      after.attackers > before.attackers ||
      after.pressure > before.pressure ||
      [...before.mobility].some(
        ([sq, n]) => "brq".includes(p.board[sq]![1]) && (after.mobility.get(sq) ?? 0) > n,
      ))
  );
}
/** Concrete offer: opponent can legally take more material than this move captured. */
export function offeredMaterial(p: Position, m: Move): number {
  const next = applyMove(p, m),
    kind = next.board[m.to]![1];
  let offer = 0;
  for (const reply of legalMoves(next).filter((r) => r.to === m.to && Boolean(r.capture))) {
    const taken = applyMove(next, reply);
    const recapture = legalMoves(taken).some((r) => r.to === reply.to && Boolean(r.capture));
    const recovered = recapture ? value[next.board[reply.from]![1]] : 0;
    offer = Math.max(offer, value[kind] - value[m.capture?.[1] ?? "k"] - recovered);
  }
  return offer;
}
