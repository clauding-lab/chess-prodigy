import { format } from "prettier";
import { assertSourcePin, sourcePins } from "./source-pins";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { parseRosterPgn, buildRosterBook, assertRosterBookLegal } from "./corpus";
for (const name of Object.keys(sourcePins) as (keyof typeof sourcePins)[])
  assertSourcePin(name, readFileSync("docs/verification/roster/" + name));
const root = "docs/verification/roster/";
const hash = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const identities = {
  Spassky: ["Spassky, Boris V", "Spassky,B"],
  Tal: "Tal, Mihail",
  Fischer: "Fischer, Robert James",
};
for (const [name, identity] of Object.entries(identities)) {
  const source = readFileSync(root + name + ".pgn"),
    archive = readFileSync(root + name + ".zip");
  console.log(`Parsing ${name}`);
  const parsed = parseRosterPgn(source.toString("utf8"), identity);
  if (!parsed.games.length) throw Error(`No accepted games for ${identity}`);
  const book = buildRosterBook(parsed.games);
  assertRosterBookLegal(book, parsed.games);
  const bookBytes = await format(JSON.stringify(book), { parser: "json", printWidth: 100 });
  const facts = {
    source: `https://www.pgnmentor.com/players/${name}.zip`,
    catalog: "https://www.pgnmentor.com/files.html",
    retrievedDateBDT: "2026-09-19",
    archiveSha256: hash(archive),
    pgnSha256: hash(source),
    catalogSha256: hash(readFileSync(root + "catalog.html")),
    acceptedIdentity: identity,
    accepted: parsed.games.length,
    excluded: parsed.excluded,
    positions: Object.keys(book).length,
    continuationOccurrences: Object.values(book)
      .flat()
      .reduce((s, [, c]) => s + c, 0),
    bookSha256: hash(bookBytes),
  };
  writeFileSync(`src/book/${name.toLowerCase()}-book.json`, bookBytes);
  for (const [path, value] of [
    [`${root}${name.toLowerCase()}-games.json`, parsed.games],
    [`${root}${name.toLowerCase()}-manifest.json`, facts],
  ] as const)
    writeFileSync(path, JSON.stringify(value) + "\n");
  console.log(JSON.stringify({ ...facts, excluded: parsed.excluded.length }));
}
