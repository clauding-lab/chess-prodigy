import morphy from "../../src/book/morphy-book.json";
import chigorin from "../../src/book/chigorin-book.json";
import spassky from "../../src/book/spassky-book.json";
import tal from "../../src/book/tal-book.json";
import fischer from "../../src/book/fischer-book.json";
import { fromFEN, posKey } from "../../src/engine/board";
import { rosterBookKey } from "../../src/engine/roster/book";
import { bookLookup } from "../../src/book/book";
import type { Sample } from "./core";
/** Cohort is chosen from frozen repertoire membership, without looking at
 * benchmark decisions or scores. Entire policy/book stays enabled during runs. */
export function isOffBook(sample: Sample): boolean {
  const p = fromFEN(sample.fen),
    compact = rosterBookKey(p);
  return (
    bookLookup(sample.history).replies.length === 0 &&
    !Object.hasOwn(morphy, posKey(p)) &&
    [chigorin, spassky, tal, fischer].every((book) => !Object.hasOwn(book, compact))
  );
}
export function selectSamples(samples: Sample[], perColor: number, cohort: string): Sample[] {
  if (cohort !== "all" && cohort !== "offbook") throw Error("Unknown sample cohort");
  const eligible = cohort === "offbook" ? samples.filter(isOffBook) : samples;
  const selected = ["w", "b"].flatMap((color) =>
    eligible.filter((s) => fromFEN(s.fen).turn === color).slice(0, perColor),
  );
  if (selected.length !== 2 * perColor) throw Error("Insufficient samples for balanced colors");
  return selected;
}
