import fs from "node:fs";
import { transformSync } from "esbuild";
import * as React from "react";

// Test-only loader exposes the real single-file functions without adding test APIs to the app.
// The optional initial-state seam installs hard-to-reach positions using React's real state hook.
export function loadPrototype(initialGame) {
  const filename = process.env.BASELINE ? "chess-app.original.jsx" : "chess-app.jsx";
  const source = fs.readFileSync(new URL("../reference/" + filename, import.meta.url), "utf8");
  const names = "START,sqIndex,legalMoves,applyMove,sanFor,posKey,toFEN,insufficientMaterial,search,quiesce,negamax,evaluate,MATE,ABORT,BOOK_LINES,bookLookup,detectMotifs,freshGame,reduceMove,ratingUpdate,defaultRating,annotateAll";
  const code = transformSync(source + "\nexport { " + names + " };\nexport function expireSearch() { deadline = -1; }", { loader: "jsx", format: "cjs" }).code;
  const react = { ...React, useState(initial) {
    return React.useState(() => {
      const value = typeof initial === "function" ? initial() : initial;
      return initialGame && value?.st && value?.hist ? initialGame(value) : value;
    });
  }};
  const module = { exports: {} };
  new Function("require", "module", "exports", code)((name) => {
    if (name === "react") return react;
    throw new Error("Unexpected import " + name);
  }, module, module.exports);
  return module.exports;
}
export function fromFEN(fen) {
  const [placement, turn, rights, ep, halfmove, fullmove] = fen.split(" ");
  const board = [];
  for (const c of placement.replaceAll("/", "")) {
    if (Number(c)) board.push(...Array(Number(c)).fill(null));
    else board.push((c === c.toUpperCase() ? "w" : "b") + c.toLowerCase());
  }
  const sqIndex = (s) => (8 - Number(s[1])) * 8 + "abcdefgh".indexOf(s[0]);
  return { board, turn, castling: Object.fromEntries(["K","Q","k","q"].map(c => [c, rights.includes(c)])), ep: ep === "-" ? null : sqIndex(ep), halfmove: Number(halfmove), fullmove: Number(fullmove) };
}
export function play(api, game, sans) {
  for (const san of sans.split(" ")) {
    const move = api.legalMoves(game.st).find(m => api.sanFor(game.st, m, api.applyMove(game.st,m)) === san);
    if (!move) throw new Error("Illegal fixture move: " + san);
    game = api.reduceMove(game, move, false);
  }
  return game;
}
