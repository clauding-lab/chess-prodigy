import { deepStrictEqual } from "node:assert";
import { readFileSync } from "node:fs";
import {
  assertChigorinBookLegal,
  buildChigorinBook,
  parseChigorinPgn,
} from "../../scripts/chigorin-history/corpus";

const parsed = parseChigorinPgn(readFileSync("docs/verification/chigorin/Chigorin.pgn", "utf8"));
if (parsed.games.length <= 600) throw new Error("Expected more than 600 accepted Chigorin games.");

const book = buildChigorinBook(parsed.games);
assertChigorinBookLegal(book, parsed.games);
deepStrictEqual(book, JSON.parse(readFileSync("src/book/chigorin-book.json", "utf8")));
