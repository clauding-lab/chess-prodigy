import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { format } from "prettier";
import { parseChigorinPgn, buildChigorinBook, assertChigorinBookLegal } from "./corpus";
const root = "docs/verification/chigorin/";
const hash = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const source = readFileSync(root + "Chigorin.pgn");
const archive = readFileSync(root + "Chigorin.zip");
if (
  hash(archive) !== "a0f2d72830ae1b94bb16e5ea293f5347f6ec6f56080fdaa80ac246918c4c43df" ||
  hash(source) !== "2417f6cd5cc94ec88a07b529c0b610ac9b06de5673db0f72d56670f4a2b166d0"
)
  throw new Error("Historical source fingerprint differs from the approved corpus.");
const parsed = parseChigorinPgn(source.toString("utf8"));
const book = buildChigorinBook(parsed.games);
assertChigorinBookLegal(book, parsed.games);
const facts = {
  source: "https://www.pgnmentor.com/players/Chigorin.zip",
  catalog: "https://www.pgnmentor.com/files.html",
  requestedUrl: "https://www.pgnmentor.com/players/Chigorin.pgn",
  requestedUrlStatus: 404,
  retrievedDateBDT: "2026-09-12",
  archiveSha256: hash(archive),
  pgnSha256: hash(source),
  acceptedIdentity: "Chigorin, Mikhail",
  accepted: parsed.games.length,
  excluded: parsed.excluded,
  positions: Object.keys(book).length,
  continuationOccurrences: Object.values(book)
    .flat()
    .reduce((s, [, c]) => s + c, 0),
};
for (const [path, value] of [
  ["src/book/chigorin-book.json", book],
  [root + "corpus-games.json", parsed.games],
  [root + "corpus-manifest.json", facts],
] as const)
  writeFileSync(path, await format(JSON.stringify(value), { parser: "json", printWidth: 100 }));
console.log(JSON.stringify({ ...facts, excluded: parsed.excluded.length }, null, 2));
