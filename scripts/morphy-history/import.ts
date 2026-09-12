import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { format } from "prettier";
import {
  assertHistoricalBookLegal,
  buildHistoricalBook,
  parseHistoricalPgn,
  type HistoricalGame,
} from "./corpus";

const COLLECTION_PAGE = "https://timkr.home.xs4all.nl/ChessTutor/morphy.htm";
const SOURCES = {
  primary: {
    archive: "/tmp/chess-morphy-history/morphy.zip",
    archiveName: "morphy.zip",
    pgnName: "MORPHY.PGN",
    archiveSha256: "c35a99b6588f3e9bf5b04abe2b85faf86039cb3b5fcb85f79bb5b7d769ff55f7",
  },
  seriousHoldout: {
    archive: "/tmp/chess-morphy-history/pmorphy.zip",
    archiveName: "pmorphy.zip",
    pgnName: "PMORPHY.PGN",
    archiveSha256: "ee2ae384a175b6fd78b9bdca1b011b3980a4bf1231184877a42e2e15591ca98f",
  },
} as const;

type ParsedSource = ReturnType<typeof parseHistoricalPgn> & {
  archiveName: string;
  pgnName: string;
  archiveSha256: string;
  pgnSha256: string;
  gameRecordIndexes: Map<string, number>;
};

function sha256(bytes: string | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function readSource(source: (typeof SOURCES)[keyof typeof SOURCES]): ParsedSource {
  const actualArchiveHash = sha256(readFileSync(source.archive));
  if (actualArchiveHash !== source.archiveSha256) {
    throw new Error(
      `${source.archiveName} fingerprint changed: expected ${source.archiveSha256}, got ${actualArchiveHash}`,
    );
  }
  const text = execFileSync("unzip", ["-p", source.archive, source.pgnName], {
    encoding: "utf8",
  });
  const parsed = parseHistoricalPgn(text);
  const excludedIndexes = new Set(parsed.excluded.map(({ index }) => index));
  const acceptedIndexes = Array.from(
    { length: parsed.games.length + parsed.excluded.length },
    (_, index) => index + 1,
  ).filter((index) => !excludedIndexes.has(index));
  return {
    ...parsed,
    archiveName: source.archiveName,
    pgnName: source.pgnName,
    archiveSha256: actualArchiveHash,
    pgnSha256: sha256(text),
    gameRecordIndexes: new Map(
      parsed.games.map((game, index) => [game.id, acceptedIndexes[index]]),
    ),
  };
}

function reasonCategory(reason: string): string {
  if (reason.startsWith("illegal or unsupported move")) return "illegal or unsupported move";
  if (reason.startsWith("exact duplicate")) return "exact duplicate";
  return reason;
}

function exclusionCounts(source: ParsedSource): Record<string, number> {
  const counts = new Map<string, number>();
  for (const { reason } of source.excluded) {
    const category = reasonCategory(reason);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return Object.fromEntries(
    [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
}

function sourceManifest(source: ParsedSource) {
  return {
    archive: source.archiveName,
    pgn: source.pgnName,
    archiveSha256: source.archiveSha256,
    pgnSha256: source.pgnSha256,
    records: source.games.length + source.excluded.length,
    accepted: source.games.length,
    excluded: source.excluded.length,
    exclusionCounts: exclusionCounts(source),
  };
}

function briefGame(game: HistoricalGame) {
  return {
    id: game.id,
    white: game.white,
    black: game.black,
    date: game.date,
    site: game.site,
    morphyColor: game.morphyColor,
    plies: game.moves.length,
  };
}

function metadataMatch(game: HistoricalGame, primaryGames: HistoricalGame[]) {
  return primaryGames.find(
    (primary) =>
      primary.white === game.white &&
      primary.black === game.black &&
      primary.date === game.date &&
      primary.site === game.site &&
      primary.moves.length === game.moves.length,
  );
}

export function importHistoricalCorpus() {
  const primary = readSource(SOURCES.primary);
  const serious = readSource(SOURCES.seriousHoldout);
  const rawPrimaryIds = new Set(primary.games.map((game) => game.id));
  const conflicts = serious.games.flatMap((seriousGame) => {
    if (rawPrimaryIds.has(seriousGame.id)) return [];
    const primaryGame = metadataMatch(seriousGame, primary.games);
    if (!primaryGame) return [];
    const firstDifference = seriousGame.moves.findIndex(
      (move, index) => move !== primaryGame.moves[index],
    );
    return [
      {
        reason: "conflicting legal move facts across primary and serious collections",
        white: seriousGame.white,
        black: seriousGame.black,
        date: seriousGame.date,
        site: seriousGame.site,
        morphyColor: seriousGame.morphyColor,
        plies: seriousGame.moves.length,
        primaryRecordIndex: primary.gameRecordIndexes.get(primaryGame.id),
        primaryId: primaryGame.id,
        seriousRecordIndex: serious.gameRecordIndexes.get(seriousGame.id),
        seriousId: seriousGame.id,
        firstDifferentPly: firstDifference + 1,
        primaryMove: primaryGame.moves[firstDifference],
        seriousMove: seriousGame.moves[firstDifference],
      },
    ];
  });
  const conflictPrimaryIds = new Set(conflicts.map(({ primaryId }) => primaryId));
  const conflictSeriousIds = new Set(conflicts.map(({ seriousId }) => seriousId));
  const corpusGames = primary.games.filter((game) => !conflictPrimaryIds.has(game.id));
  const primaryIds = new Set(corpusGames.map((game) => game.id));
  const holdoutIds = serious.games
    .filter((game) => !conflictSeriousIds.has(game.id) && primaryIds.has(game.id))
    .map((game) => game.id)
    .sort();
  const unmatchedHoldout = serious.games
    .filter((game) => !conflictSeriousIds.has(game.id) && !primaryIds.has(game.id))
    .map((game) => ({
      ...briefGame(game),
      reason: "no metadata-matched game in primary corpus",
    }));
  const book = buildHistoricalBook(corpusGames);
  assertHistoricalBookLegal(book, corpusGames);

  const gamesArtifact = {
    schemaVersion: 1,
    collectionPage: COLLECTION_PAGE,
    sources: {
      primary: sourceManifest(primary),
      seriousHoldout: sourceManifest(serious),
    },
    counts: {
      games: corpusGames.length,
      plies: corpusGames.reduce((sum, game) => sum + game.moves.length, 0),
      documentedMorphyTurns: Object.values(book).reduce(
        (total, continuations) =>
          total + continuations.reduce((positionTotal, [, count]) => positionTotal + count, 0),
        0,
      ),
      bookPositions: Object.keys(book).length,
      bookContinuations: Object.values(book).reduce(
        (total, continuations) => total + continuations.length,
        0,
      ),
      acceptedSeriousGames: serious.games.length,
      matchedHoldoutGames: holdoutIds.length,
      crossSourceConflicts: conflicts.length,
      unmatchedHoldoutGames: unmatchedHoldout.length,
    },
    exclusions: [
      ...primary.excluded.map((excluded) => ({ source: "primary", ...excluded })),
      ...serious.excluded.map((excluded) => ({ source: "seriousHoldout", ...excluded })),
    ],
    crossSourceConflicts: conflicts,
    unmatchedHoldout,
    holdoutIds,
    games: corpusGames,
  };

  return { gamesArtifact, book };
}

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { gamesArtifact, book } = importHistoricalCorpus();
  writeFileSync(
    resolve(repositoryRoot, "src/book/morphy-games.json"),
    await format(JSON.stringify(gamesArtifact), { parser: "json", printWidth: 100 }),
  );
  writeFileSync(
    resolve(repositoryRoot, "src/book/morphy-book.json"),
    await format(JSON.stringify(book), { parser: "json", printWidth: 100 }),
  );
  console.log(JSON.stringify(gamesArtifact.counts, null, 2));
}
