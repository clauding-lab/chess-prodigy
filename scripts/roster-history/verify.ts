import { assertSourcePin, sourcePins } from "./source-pins";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseRosterPgn, buildRosterBook, assertRosterBookLegal } from "./corpus";
for (const name of Object.keys(sourcePins) as (keyof typeof sourcePins)[])
  assertSourcePin(name, readFileSync("docs/verification/roster/" + name));
const root = "docs/verification/roster/",
  hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
for (const name of ["Spassky", "Tal", "Fischer"]) {
  const id = name.toLowerCase(),
    facts = JSON.parse(readFileSync(root + id + "-manifest.json", "utf8")),
    bytes = readFileSync(root + name + ".pgn");
  assert.equal(hash(bytes), facts.pgnSha256);
  assert.equal(hash(readFileSync(root + name + ".zip")), facts.archiveSha256);
  assert.equal(hash(readFileSync(root + "catalog.html")), facts.catalogSha256);
  const parsed = parseRosterPgn(bytes.toString("utf8"), facts.acceptedIdentity);
  assert.deepEqual(parsed.games, JSON.parse(readFileSync(root + id + "-games.json", "utf8")));
  assert.deepEqual(parsed.excluded, facts.excluded);
  assert.equal(parsed.games.length, facts.accepted);
  const rebuilt = buildRosterBook(parsed.games),
    book = JSON.parse(readFileSync(`src/book/${id}-book.json`, "utf8"));
  assert.equal(hash(readFileSync(`src/book/${id}-book.json`)), facts.bookSha256);
  assert.deepEqual(book, rebuilt);
  assertRosterBookLegal(book, parsed.games);
  assert.equal(Object.keys(book).length, facts.positions);
  assert.equal(
    Object.values(rebuilt)
      .flat()
      .reduce((s, [, c]) => s + c, 0),
    facts.continuationOccurrences,
  );
  console.log(
    `${name}: ${facts.accepted} accepted, ${facts.excluded.length} excluded, ${facts.positions} positions`,
  );
}
console.log("All three complete corpora verified");
