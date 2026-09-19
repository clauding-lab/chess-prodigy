import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test } from "vitest";
import {
  parseRosterPgn,
  buildRosterBook,
  assertRosterBookLegal,
} from "../../scripts/roster-history/corpus";
const record = (white = "Tal, Mihail", moves = "1. e4 e5 2. Nf3 Nc6 *", tags = "") =>
  `[White "${white}"]\n[Black "Opponent"]\n[Result "*"]\n${tags}\n${moves}`;
test("exact identities, ordinary histories and explicit exclusions", () => {
  const good = record(),
    corpus = [
      good,
      good,
      record("Tal, Mikhail"),
      record("Tal, Mihail", "1. e5 *"),
      record("Tal, Mihail", undefined, '[SetUp "1"]'),
      record("Tal, Mihail", undefined, '[Event "Consultation"]'),
      record("Tal, Mihail", undefined, '[Odds "pawn"]'),
    ].join("\n\n");
  const parsed = parseRosterPgn(corpus, "Tal, Mihail");
  expect(parsed.games).toHaveLength(1);
  expect(parsed.excluded).toHaveLength(6);
  const book = buildRosterBook(parsed.games);
  assertRosterBookLegal(book, parsed.games);
  expect(
    Object.values(book)
      .flat()
      .reduce((s, [, c]) => s + c, 0),
  ).toBe(2);
});
test("full exact source rebuild validates all legal moves, collisions and occurrences in child process", async () => {
  const run = promisify(execFile);
  const result = await run(
    process.execPath,
    ["--import", "tsx", "scripts/roster-history/verify.ts"],
    { timeout: 600_000, maxBuffer: 1024 * 1024 },
  );
  expect(result.stdout).toContain("All three complete corpora verified");
}, 620_000);

test("ordinary team tournament is accepted but combined participants are not", () => {
  expect(
    parseRosterPgn(record("Tal, Mihail", undefined, '[Event "Team championship"]'), "Tal, Mihail")
      .games,
  ).toHaveLength(1);
  expect(parseRosterPgn(record("Tal, Mihail/Partner"), "Tal, Mihail").excluded).toHaveLength(1);
});

test("different aliases of the same roster player cannot be both opponents", () => {
  const text = record("Spassky,B").replace('[Black "Opponent"]', '[Black "Spassky, Boris V"]');
  expect(parseRosterPgn(text, ["Spassky,B", "Spassky, Boris V"]).games).toHaveLength(0);
});
