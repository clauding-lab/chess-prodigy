import { describe, expect, it } from "vitest";
import { BOOK_LINES } from "../../src/book/lines";
import { bookLookup } from "../../src/book/book";
import { START, applyMove, legalMoves, sanFor } from "../../src/engine/board";
import { loadPrototype } from "../prototype";

describe("opening book", () => {
  it("contains every supplied opening line", () => {
    expect(BOOK_LINES).toHaveLength(185);
    expect(new Set(BOOK_LINES.map(([moves]) => moves)).size).toBe(185);
  });

  it("preserves every opening field verbatim", () => {
    expect(BOOK_LINES).toEqual(loadPrototype().BOOK_LINES);
  });

  it("plays all 185 lines using their exact SAN", () => {
    for (const [line] of BOOK_LINES) {
      let position = START();
      for (const san of line.split(" ")) {
        const move = legalMoves(position).find(
          (candidate) => sanFor(position, candidate, applyMove(position, candidate)) === san,
        );
        expect(move, `${line}: ${san}`).toBeDefined();
        position = applyMove(position, move!);
      }
    }
  });

  it("walks named lines and exposes continuations", () => {
    const root = bookLookup([]);
    expect(root.inBook).toBe(true);
    expect(root.info).toBeNull();
    expect(root.replies).toContain("e4");

    const spanish = bookLookup(["e4", "e5", "Nf3", "Nc6", "Bb5"]);
    expect(spanish.info?.name).toBe("Ruy Lopez (Spanish)");
    expect(spanish.info?.depth).toBe(5);
    expect(spanish.replies).toContain("a6");
  });

  it("reports the first move outside the tree", () => {
    expect(bookLookup(["e4", "e5", "Ke2"])).toMatchObject({
      inBook: false,
      leftAt: 3,
      replies: [],
    });
  });
});
