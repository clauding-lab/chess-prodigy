import { describe, expect, it } from "vitest";
import {
  START,
  applyMove,
  legalMoves,
  posKey,
  sameMove,
  sanFor,
  sqName,
} from "../../src/engine/board";
import generatedBook from "../../src/book/morphy-book.json";
import generatedCorpus from "../../src/book/morphy-games.json";
import {
  assertHistoricalBookLegal,
  buildHistoricalBook,
  parseHistoricalPgn,
  replayHistoricalGame,
  type HistoricalBook,
  type HistoricalGame,
} from "../../scripts/morphy-history/corpus";

const pgn = (tags: string, moves: string) =>
  `[Event "Test"]\n[Site "New Orleans"]\n[Date "1858.01.01"]\n${tags}\n[Result "*"]\n\n${moves}`;

describe("historical Morphy PGN corpus", () => {
  it("normalizes legal long algebraic notation to SAN", () => {
    const parsed = parseHistoricalPgn(
      pgn('[White "Morphy"]\n[Black "Opponent"]', "1.e2-e4 e7-e5 2.Ng1-f3 *"),
    );

    expect(parsed.excluded).toEqual([]);
    expect(parsed.games).toMatchObject([
      {
        white: "Morphy",
        black: "Opponent",
        date: "1858.01.01",
        site: "New Orleans",
        morphyColor: "w",
        moves: ["e4", "e5", "Nf3"],
      },
    ]);
    expect(parsed.games[0].id).toMatch(/^[a-f0-9]{64}$/);
  });

  it("accepts SAN and strips comments, variations, NAGs and annotations", () => {
    const parsed = parseHistoricalPgn(
      pgn(
        '[White "Opponent"]\n[Black "Morphy"]',
        "1. e4 {editorial prose} e5 (1... c5 $1) 2. Nf3!? Nc6 ; line note\n3. Bb5 *",
      ),
    );

    expect(parsed.games[0].moves).toEqual(["e4", "e5", "Nf3", "Nc6", "Bb5"]);
    expect(parsed.games[0].morphyColor).toBe("b");
  });

  it.each(["1/2", "1-0\u001a"])("accepts the source termination marker %j", (result) => {
    const parsed = parseHistoricalPgn(
      pgn('[White "Morphy"]\n[Black "Opponent"]', `1.e4 e5 ${result}`),
    );

    expect(parsed.games[0].moves).toEqual(["e4", "e5"]);
    expect(parsed.excluded).toEqual([]);
  });

  it("normalizes castling and promotion from legal start-position play", () => {
    const castle = parseHistoricalPgn(
      pgn(
        '[White "Morphy"]\n[Black "Opponent"]',
        "1.e2-e4 e7-e5 2.Ng1-f3 Nb8-c6 3.Bf1-c4 Ng8-f6 4.O-O *",
      ),
    );
    const promotion = parseHistoricalPgn(
      pgn(
        '[White "Morphy"]\n[Black "Opponent"]',
        "1.a2-a4 h7-h5 2.a4-a5 h5-h4 3.a5-a6 h4-h3 4.a6xb7 h3xg2 5.b7xa8Q g2xh1Q *",
      ),
    );

    expect(castle.games[0].moves.at(-1)).toBe("O-O");
    expect(promotion.games[0].moves.slice(-2)).toEqual(["bxa8=Q", "gxh1=Q"]);
  });

  it("rejects setup, FEN and odds records before attempting replay", () => {
    const input = [
      pgn('[White "Morphy"]\n[Black "Opponent"]\n[SetUp "1"]', "1.e4 *"),
      pgn(
        '[White "Morphy"]\n[Black "Opponent"]\n[FEN "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -\n 0 1"]',
        "1.e4 *",
      ),
      '[Event "Pawn and move odds"]\n[Site "New Orleans"]\n[Date "1858"]\n[White "Morphy"]\n[Black "Opponent"]\n[Result "*"]\n\n1.e4 *',
    ].join("\n\n");

    expect(parseHistoricalPgn(input)).toEqual({
      games: [],
      excluded: [
        { index: 1, reason: "setup or FEN position" },
        { index: 2, reason: "setup or FEN position" },
        { index: 3, reason: "odds game" },
      ],
    });
  });

  it("selects only the exact player name Morphy", () => {
    const parsed = parseHistoricalPgn(
      pgn('[White "Alonzo Morphy"]\n[Black "Opponent"]', "1.e4 e5 *"),
    );

    expect(parsed.games).toEqual([]);
    expect(parsed.excluded).toEqual([{ index: 1, reason: 'player name is not exactly "Morphy"' }]);
  });

  it("rejects an entire record after any illegal trailing move", () => {
    const parsed = parseHistoricalPgn(
      pgn('[White "Morphy"]\n[Black "Opponent"]', "1.e4 e5 2.Nf3 Nc6 3.Nf3 *"),
    );

    expect(parsed.games).toEqual([]);
    expect(parsed.excluded).toEqual([
      { index: 1, reason: 'illegal or unsupported move at ply 5: "Nf3"' },
    ]);
  });

  it("rejects a record with an unterminated comment or variation", () => {
    const parsed = parseHistoricalPgn(
      pgn('[White "Morphy"]\n[Black "Opponent"]', "1.e4 e5 {unfinished commentary"),
    );

    expect(parsed.games).toEqual([]);
    expect(parsed.excluded).toEqual([{ index: 1, reason: "unterminated comment or variation" }]);
  });

  it("deduplicates normalized moves plus Morphy color", () => {
    const first = pgn('[White "Morphy"]\n[Black "First"]', "1.e2-e4 e7-e5 *");
    const duplicate = pgn('[White "Morphy"]\n[Black "Second"]', "1. e4 e5 *");
    const oppositeColor = pgn('[White "First"]\n[Black "Morphy"]', "1. e4 e5 *");
    const parsed = parseHistoricalPgn([first, duplicate, oppositeColor].join("\n\n"));

    expect(parsed.games).toHaveLength(2);
    expect(parsed.games[0].id).not.toBe(parsed.games[1].id);
    expect(parsed.excluded).toEqual([
      { index: 2, reason: `exact duplicate of ${parsed.games[0].id}` },
    ]);
  });

  it("keeps a new header block even when its optional Event tag is absent", () => {
    const withoutEvent =
      '[Site "Philadelphia"]\n[Date "1859"]\n[White "Morphy"]\n[Black "Second"]\n[Result "*"]\n\n1.d4 d5 *';
    const parsed = parseHistoricalPgn(
      [pgn('[White "Morphy"]\n[Black "First"]', "1.e4 e5 *"), withoutEvent].join("\n\n"),
    );

    expect(parsed.games.map((game) => game.moves)).toEqual([
      ["e4", "e5"],
      ["d4", "d5"],
    ]);
  });
});

describe("historical Morphy repertoire", () => {
  it("indexes only Morphy's own turns and counts actual UCI continuations", () => {
    const parsed = parseHistoricalPgn(
      [
        pgn('[White "Morphy"]\n[Black "First"]', "1.e4 e5 2.Nf3 *"),
        pgn('[White "Morphy"]\n[Black "Second"]', "1.e4 c5 2.Nf3 *"),
        pgn('[White "Opponent"]\n[Black "Morphy"]', "1.d4 d5 2.c4 *"),
      ].join("\n\n"),
    );
    const book = buildHistoricalBook(parsed.games);

    expect(book[posKey(START())]).toEqual([["e2e4", 2]]);

    for (const game of parsed.games) {
      let position = START();
      for (const move of replayHistoricalGame(game)) {
        if (position.turn === game.morphyColor) {
          const uci = `${sqName(move.from)}${sqName(move.to)}${move.promo ?? ""}`;
          expect(book[posKey(position)]).toContainEqual(
            expect.arrayContaining([uci, expect.any(Number)]),
          );
          expect(legalMoves(position).some((candidate) => sameMove(candidate, move))).toBe(true);
        }
        const next = applyMove(position, move);
        expect(sanFor(position, move, next)).toBe(
          game.moves[position.fullmove * 2 - (position.turn === "w" ? 2 : 1)],
        );
        position = next;
      }
    }
  });

  it("rejects any generated continuation that is not legal in its keyed position", () => {
    const parsed = parseHistoricalPgn(pgn('[White "Morphy"]\n[Black "Opponent"]', "1.e4 e5 *"));
    const valid = buildHistoricalBook(parsed.games);

    expect(() => assertHistoricalBookLegal(valid, parsed.games)).not.toThrow();
    expect(() =>
      assertHistoricalBookLegal({ ...valid, [posKey(START())]: [["e2e5", 1]] }, parsed.games),
    ).toThrow("illegal continuation e2e5");
  });

  it("legally replays the committed corpus, repertoire and serious-game holdout", () => {
    const games = generatedCorpus.games as HistoricalGame[];
    const gameIds = new Set(games.map((game) => game.id));
    const book = generatedBook as unknown as HistoricalBook;

    expect(games).toHaveLength(247);
    expect(generatedCorpus.holdoutIds).toHaveLength(57);
    expect(generatedCorpus.holdoutIds.every((id) => gameIds.has(id))).toBe(true);
    expect(gameIds).not.toContain(
      "a30d96004519fcc3650d295ba4d8dfaa98833ad746b973febafe16d3b015e574",
    );
    expect(generatedCorpus.crossSourceConflicts).toEqual([
      expect.objectContaining({
        primaryRecordIndex: 154,
        primaryId: "a30d96004519fcc3650d295ba4d8dfaa98833ad746b973febafe16d3b015e574",
        seriousRecordIndex: 20,
        seriousId: "3813d62f1c7e5e8f82a8695a7bf700ee9bc43fc10c252aebcfbcac0e976ffb1f",
        firstDifferentPly: 55,
        primaryMove: "Kb1",
        seriousMove: "Nb1",
      }),
    ]);
    expect(book[posKey(START())]).toEqual([["e2e4", 152]]);
    expect(() => assertHistoricalBookLegal(book, games)).not.toThrow();
  }, 15_000);
});
