import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { expect, test } from "vitest";
import {
  parseChigorinPgn,
  buildChigorinBook,
  assertChigorinBookLegal,
} from "../../scripts/chigorin-history/corpus";
const record = (white = "Chigorin, Mikhail", extra = "", moves = "1.e4 e5 2.Nf3 Nc6 1-0") =>
  `[Event "test"]\n[White "${white}"]\n[Black "Opponent"]\n[Result "1-0"]\n${extra}\n${moves}\n`;
test("exact named ordinary player games only; reject odds, consultation, ambiguous names, setups, variants and broken notation", () => {
  for (const pgn of [
    record("Chigorin"),
    record("Chigorin, Mikhail / Partner"),
    record("Chigorin, Mikhail", '[SetUp "1"]'),
    record("Chigorin, Mikhail", '[Event "consultation"]'),
    record("Chigorin, Mikhail", '[Odds "pawn"]'),
    record("Chigorin, Mikhail", '[Variant "Chess960"]'),
    record("Chigorin, Mikhail", "", "1.e5 1-0"),
    record("Chigorin, Mikhail", "", "1.e4 {oops"),
  ]) {
    const x = parseChigorinPgn(pgn);
    expect(x.games).toHaveLength(0);
    expect(x.excluded).toHaveLength(1);
  }
  expect(parseChigorinPgn(record()).games).toHaveLength(1);
  expect(parseChigorinPgn(record() + "\n" + record()).excluded[0].reason).toMatch(/duplicate/);
});
test("source games reproduce the checked compact book with legal occurrence frequencies", async () => {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "tests/engine/chigorin-corpus-worker.ts"],
      {
        stdio: ["ignore", "ignore", "pipe"],
      },
    );
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `Corpus worker exited with ${code}.`));
    });
  });
}, 120000);

test("rejects malformed headers, duplicate tags, result mismatches and moves after a result", () => {
  for (const pgn of [
    record("Chigorin, Mikhail", '[White "Chigorin, Mikhail"]'),
    record("Chigorin, Mikhail", "[Broken noquote]"),
    record("Chigorin, Mikhail", "", "1.e4 1-0 e5"),
    record("Chigorin, Mikhail", "", "1.e4 e5 0-1"),
    record("Chigorin, Mikhail", "", "1.e4 e5"),
  ])
    expect(parseChigorinPgn(pgn).games).toHaveLength(0);
});
