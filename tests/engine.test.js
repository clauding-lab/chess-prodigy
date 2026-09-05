import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { loadPrototype, fromFEN, play } from "./prototype.js";
const api = loadPrototype();
const setup = { playerColor: "w", level: "club", time: "none" };
describe("approved regression fixes", () => {
  it("counts the position after e4 in threefold repetition when en passant is impossible", () => {
    const g = play(api, api.freshGame(setup), "e4 Nf6 Nf3 Ng8 Ng1 Nf6 Nf3 Ng8 Ng1");
    expect(g.over?.reason).toBe("Threefold repetition");
  });
  it("keeps a legal en-passant capture in the repetition identity", () => {
    const a = fromFEN("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1");
    expect(api.posKey(a)).not.toBe(api.posKey({ ...a, ep: null }));
  });
  it("ignores pinned en passant without changing FEN export", () => {
    const a = fromFEN("k3r3/8/8/3pP3/8/8/8/4K3 w - d6 0 1");
    expect(api.posKey(a)).toBe(api.posKey({ ...a, ep: null }));
    expect(api.toFEN(a)).toContain(" d6 ");
  });
  it("does not apply a promotion after a timeout", () => {
    const st = fromFEN("7k/P7/8/8/8/8/8/4K3 w - - 0 1");
    const g = { ...api.freshGame(setup), st, over: { result: "0-1", reason: "Time out" } };
    const promotion = api.legalMoves(st).find(m => m.promo === "q");
    expect(api.reduceMove(g, promotion, false)).toBe(g);
  });
  it("reports only the applied rating change at the floor", () => {
    const r = api.ratingUpdate(api.defaultRating(), 900, 0, { opp: "Casual" });
    expect(r.next.rating).toBe(1400);
    expect(r.delta).toBe(0);
    expect(r.next.history[0].delta).toBe(0);
  });
  it("reports the partial actual loss when a rating crosses the floor", () => {
    const r = api.ratingUpdate({ ...api.defaultRating(), rating: 1410, peak: 1410 }, 900, 0, { opp: "Casual" });
    expect(r.delta).toBe(-10);
    expect(r.next.rating).toBe(1400);
  });
  it("recognises mate inside quiescence rather than standing pat", () => {
    const st = fromFEN("7k/6Q1/5K2/8/8/8/8/8 b - - 0 1");
    expect(api.quiesce(st, -Infinity, Infinity, 4)).toBeLessThan(-99000);
  });
  it("searches quiet check evasions even with a narrow beta window", () => {
    // White must play Kb1; black can then take the queen on h7 with the f8 knight.
    const st = fromFEN("5n2/7Q/8/8/8/1bk5/r7/K7 w - - 0 1");
    expect(api.legalMoves(st).every(m => !m.capture && !m.promo)).toBe(true);
    expect(api.quiesce(st, -Infinity, -500, 4)).toBeLessThan(-500);
  });
  it("checks the deadline inside quiescence", () => {
    const isolated = loadPrototype();
    isolated.expireSearch();
    expect(() => isolated.quiesce(isolated.START(), -Infinity, Infinity, 4)).toThrow();
  });
});

  it("settles a late submitted move before any clock callback fires", () => {
    const base=api.freshGame({...setup,time:"5+0"});
    const g={...base,started:true,clocks:{w:1000,b:1000},clockAt:0};
    const m=api.legalMoves(g.st).find(m=>m.from===52 && m.to===36);
    const next=api.reduceMove(g,m,false,1500);
    expect(next.over?.reason).toBe("Time out");
    expect(next.hist).toHaveLength(0);
    expect(next.clocks.w).toBe(0);
  });
describe("retained engine and content", () => {
  function perft(s, d) { return d === 0 ? 1 : api.legalMoves(s).reduce((n,m) => n + perft(api.applyMove(s,m),d-1),0); }
  it.each([
    ["start", api.START(), [20,400,8902]],
    ["Kiwipete", fromFEN("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1"), [48,2039]],
    ["position 3", fromFEN("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1"), [14,191,2812]]
  ])("%s legal move counts", (_name, st, counts) => { expect(counts.map((_,d) => perft(st,d+1))).toEqual(counts); });
  it("plays all 185 opening lines using their exact SAN", () => {
    expect(api.BOOK_LINES).toHaveLength(185);
    for (const [line] of api.BOOK_LINES) play(api, api.freshGame(setup), line);
  });
  it("preserves every opening entry and motif card verbatim", () => {
    const original = fs.readFileSync(path.resolve("reference/chess-app.original.jsx"),"utf8");
    const current = fs.readFileSync(path.resolve("reference/chess-app.jsx"),"utf8");
    for (const name of ["BOOK_LINES", "MOTIFS"]) {
      const block = s => s.slice(s.indexOf("const " + name + " ="), s.indexOf("\n};", s.indexOf("const " + name + " =")) + 3);
      expect(block(current)).toBe(block(original));
    }
  });
  it("matches all supplied motif fixtures", () => {
    const handoff = fs.readFileSync(path.resolve("CODEX_HANDOFF.md"),"utf8");
    const rows = handoff.split("\n").filter(l => l.startsWith("| " + String.fromCharCode(96)));
    expect(rows).toHaveLength(12);
    for (const row of rows) {
      const [,fen,san,expected] = row.split("|").map(x=>x.trim());
      const st = fromFEN(fen.replaceAll(String.fromCharCode(96),""));
      const m = api.legalMoves(st).find(m => api.sanFor(st,m,api.applyMove(st,m)) === san);
      expect(m, san).toBeDefined();
      const found = api.detectMotifs(st,m,api.applyMove(st,m),san.endsWith("#")?{reason:"Checkmate"}:null).map(m=>m.key);
      if (expected.startsWith("*no fork*")) expect(found).not.toContain("fork");
      else for (const key of expected.split(" (")[0].split(", ")) expect(found).toContain(key);
    }
  });
  it("finds mate in one and respects a short search budget", () => {
    const st = fromFEN("7k/8/5KQ1/8/8/8/8/8 w - - 0 1");
    const r = api.search(st, 4, 150);
    expect(api.sanFor(st,r.move,api.applyMove(st,r.move))).toMatch(/#$/);
    const start = Date.now();
    api.search(api.START(), 10, 100);
    expect(Date.now() - start).toBeLessThan(250);
  });
});
