/** Independent audit: no imports from calibration estimators, match runners or verifiers.
 * Run: Node22 --import tsx THIS_FILE RUN_ROOT PLAYER OUTPUT_JSON [--self-test | --pack PACK_DIRECTORY]
 * RUN_ROOT contains frozen/, frozen-files.sha256, frozen-source.tar.gz, PLAYER/ and logs/.
 * Adapted from the independent Chigorin audit; no measurement implementation imports.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve, posix } from "node:path";
import { tmpdir } from "node:os";
import { gunzipSync, gzipSync } from "node:zlib";
import { pathToFileURL } from "node:url";

type Json = Record<string, unknown>;
type Level = "casual" | "club" | "strong";
type Score = 0 | 0.5 | 1 | null;
type Board = typeof import("../../../src/engine/board");
type Position = ReturnType<Board["START"]>;
const COMMIT = "9a7ab6c4eaba629d87cec8f77a163660ecdd240c";
const ARCHIVE_HASH = "d9696798ab7f0032d0c9b0b347a848c4b34cd3c83d27bc4f92c478a35d5caca9";
const PLAYER = process.argv[3];
assert.ok(["spassky", "tal", "fischer"].includes(PLAYER), "Expected roster player");
const PROTOCOL = `${PLAYER}-plans-paired-v1`;
const INVENTORY_HASH = "7d84045a58c536be23eaaf4f110cee7b2db404c69c10a224b45c1cf63a12f44d";
const LEVELS: Level[] = ["casual", "club", "strong"];
const CHECKPOINTS = [50, 100, 200];
const ANCHORS = { casual: 900, club: 1350, strong: 1800 };
const SETTINGS = {
  casual: { depth: 1, ms: 200, noise: 120, book: 0.5 },
  club: { depth: 2, ms: 600, noise: 15, book: 1 },
  strong: { depth: 4, ms: 2000, noise: 0, book: 1 },
};
const IDENTITY = {
  id: PLAYER, version: 1, engine: `${PLAYER}-plans-v1`, randomPolicy: "seeded-per-ply-v1",
};
const MANIFEST_SOURCES = [
  "package.json", "package-lock.json", "tsconfig.json", "tsconfig.server.json",
  "src/engine/board.ts", "src/engine/eval.ts", "src/engine/search.ts", "src/engine/morphy.ts",
  "src/engine/morphy-plans.ts", "src/engine/opponents.ts", "src/engine/historical-features.ts",
  "src/engine/historical-morphy.ts", "src/engine/morphy-model.json", "src/engine/types.ts",
  "src/book/lines.ts", "src/book/book.ts", "src/book/morphy-games.json", "src/book/morphy-book.json",
  "src/rating/fide.ts", "scripts/morphy-history/corpus.ts", "scripts/morphy-history/import.ts",
  "scripts/morphy-history/train.ts", "docs/verification/morphy-history/training.json",
  "scripts/calibration/core.ts", "scripts/calibration/protocol.ts", "scripts/calibration/match.ts",
  "scripts/calibration/run.ts", "scripts/calibration/worker.ts", "scripts/calibration/plans-behaviour.ts",
  "docs/verification/morphy-plans/behaviour-protocol.md", "src/engine/chigorin.ts",
  "src/engine/chigorin-book.ts", "src/book/chigorin-book.json",
  "src/rating/opponents.ts", "src/engine/roster/types.ts", "src/engine/roster/features.ts",
  "src/engine/roster/policy.ts", "src/engine/roster/book.ts", "src/engine/roster/dispatch.ts",
  "src/engine/roster/worker.ts", "src/worker/protocol.ts", "src/worker/client.ts", "vite.config.ts",
  ...["spassky", "tal", "fischer"].flatMap((id) => [
    `src/engine/roster/${id}.ts`, `src/book/${id}-book.json`, `src/engine/${id}.worker.ts`,
  ]),
  "scripts/roster-history/corpus.ts", "scripts/roster-history/import.ts",
  "scripts/roster-history/source-pins.ts", "docs/verification/roster/behaviour-protocol.md",
].sort();
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
function object(value: unknown, label: string): Json {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value), label);
  return value as Json;
}
function json(file: string): Json { return object(JSON.parse(readFileSync(file, "utf8")), file); }
function number(value: unknown, label: string): number {
  assert.ok(typeof value === "number" && Number.isFinite(value), label);
  return value;
}
function almost(actual: unknown, expected: number | null, label: string) {
  if (expected === null) assert.equal(actual, null, label);
  else assert.ok(Math.abs(number(actual, label) - expected) <= 1e-8, label);
}
function sourceAudit(root: string) {
  const archive = join(root, "frozen-source.tar.gz");
  const bytes = readFileSync(archive);
  assert.equal(hash(bytes), ARCHIVE_HASH, "Frozen archive hash");
  assert.equal(readFileSync(join(root, "frozen-source.tar.gz.sha256"), "utf8").split(/\s+/)[0], ARCHIVE_HASH);
  assert.equal(execFileSync("git", ["get-tar-commit-id"], { input: gunzipSync(bytes).subarray(0, 1024), encoding: "utf8" }).trim(), COMMIT);
  const inventoryBytes = readFileSync(join(root, "frozen-files.sha256"));
  assert.equal(hash(inventoryBytes), INVENTORY_HASH, "Pinned inventory hash");
  const inventory: Json = {};
  for (const line of inventoryBytes.toString().trim().split("\n")) {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    assert.ok(match, "Inventory line");
    const prefix = `${join(root, "frozen")}/`;
    assert.ok(match[2].startsWith(prefix), "Inventory root");
    const path = match[2].slice(prefix.length);
    assert.ok(!(path in inventory), "Duplicate inventory entry");
    inventory[path] = match[1];
  }
  const names = Object.keys(inventory).sort();
  assert.equal(names.length, 417, "Frozen file count");
  const archiveTypes = execFileSync("tar", ["-tvf", archive], { encoding: "utf8" }).trim().split("\n");
  assert.ok(archiveTypes.every((line) => line.startsWith("-") || line.startsWith("d")), "Archive must contain only ordinary files/directories");
  const archived = execFileSync("tar", ["-tf", archive], { encoding: "utf8" })
    .trim().split("\n").filter((file) => !file.endsWith("/")).sort();
  assert.deepEqual(archived, names, "Archive and inventory path sets");
  for (const file of names) {
    assert.ok(!file.startsWith("/") && !file.split("/").includes(".."), file);
    assert.match(String(inventory[file]), /^[a-f0-9]{64}$/);
    const archivedBytes = execFileSync("tar", ["-xOf", archive, file], { maxBuffer: 32 * 1024 * 1024 });
    assert.equal(hash(archivedBytes), inventory[file], `Archived bytes: ${file}`);
    assert.equal(hash(readFileSync(join(root, "frozen", file))), inventory[file], `Frozen bytes: ${file}`);
  }
  function walk(relative = ""): string[] {
    return readdirSync(join(root, "frozen", relative), { withFileTypes: true }).flatMap((entry) => {
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      if (path === "node_modules") return [];
      assert.ok(!entry.isSymbolicLink(), `Unexpected frozen symlink: ${path}`);
      return entry.isDirectory() ? walk(path) : [path];
    });
  }
  assert.deepEqual(walk().sort(), names, "No unexpected frozen source files outside node_modules");
  // Independently walk local import edges, including the Node dispatcher and shared helpers.
  const visited = new Set<string>();
  function imports(file: string) {
    if (visited.has(file)) return;
    visited.add(file);
    assert.ok(MANIFEST_SOURCES.includes(file), `Unfingerprinted transitive dependency: ${file}`);
    if (!file.endsWith(".ts")) return;
    const source = readFileSync(join(root, "frozen", file), "utf8");
    for (const match of source.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)["'](\.[^"']+)["']/g)) {
      const base = posix.normalize(posix.join(posix.dirname(file), match[1]));
      const target = [base, `${base}.ts`, `${base}.json`, `${base}/index.ts`].find((name) => name in inventory);
      assert.ok(target, `Unresolved local import: ${file}: ${match[1]}`);
      imports(target);
    }
  }
  imports("scripts/calibration/worker.ts");
  return { inventory, archiveSha256: ARCHIVE_HASH, inventorySha256: hash(inventoryBytes), files: names.length };
}

/** Derive Wilson bounds algebraically on pair count, then convert the score interval to Elo. */
function statistics(scores: Score[], level: Level) {
  assert.ok(scores.length > 0 && scores.length % 2 === 0);
  assert.ok(scores.every((score) => score === null || score === 0 || score === 0.5 || score === 1));
  const pairs = scores.length / 2;
  const unresolved = scores.filter((score) => score === null).length;
  const points = scores.reduce<number>((sum, score) => sum + (score ?? 0), 0);
  const p = points / scores.length;
  function bound(probability: number, upper: boolean) {
    const z = 2.4;
    const discriminant = z * Math.sqrt(pairs * probability * (1 - probability) + z * z / 4);
    return (pairs * probability + z * z / 2 + (upper ? discriminant : -discriminant)) / (pairs + z * z);
  }
  const elo = (probability: number) => ANCHORS[level] + 400 * Math.log10(probability / (1 - probability));
  const finite = (value: number) => Number.isFinite(value) ? value : null;
  const rating = unresolved ? null : finite(elo(p));
  const lower = finite(elo(Math.max(0, bound(p, false))));
  const upper = finite(elo(Math.min(1, bound((points + unresolved) / scores.length, true))));
  const width = lower !== null && upper !== null ? upper - lower : null;
  const eligible = CHECKPOINTS.includes(pairs) && unresolved === 0 && rating !== null &&
    rating >= 0 && rating <= 10000 && width !== null && width <= 300;
  return {
    rating, lower, upper, games: scores.length, unresolved, eligible, protocol: PROTOCOL,
    opponentVersion: 1, level, pairs,
    wins: scores.filter((s) => s === 1).length,
    draws: scores.filter((s) => s === 0.5).length,
    losses: scores.filter((s) => s === 0).length,
    width, fixedRating: eligible ? 25 * Math.floor(rating! / 25 + 0.5) : null,
  };
}
function compareSummary(saved: Json, expected: ReturnType<typeof statistics>, label: string) {
  const keys = ["rating", "lower", "upper", "games", "unresolved", "eligible", "protocol", "opponentVersion", "level", "pairs", "wins", "draws", "losses"];
  assert.deepEqual(Object.keys(saved).sort(), keys.sort(), `${label} fields`);
  for (const key of ["rating", "lower", "upper"] as const) almost(saved[key], expected[key], `${label}: ${key}`);
  for (const key of keys.filter((key) => !["rating", "lower", "upper"].includes(key)))
    assert.deepEqual(saved[key], expected[key as keyof typeof expected], `${label}: ${key}`);
}
function manifestAudit(manifest: Json, level: Level, inventory: Json) {
  const expected = {
    schemaVersion: 2, protocol: PROTOCOL, opponent: IDENTITY,
    classic: { id: "classic", version: 1, engine: "classic-v1", randomPolicy: "seeded-match-stream-v1", book: "production-book-v1" },
    level, maxPlies: 1000, anchor: ANCHORS[level],
    productionSettings: { classic: SETTINGS[level], morphy: SETTINGS[level] },
    openingPolicy: "start-position-v1", pairSeedPolicy: "color-swapped-20260912-v1", adjudication: "none",
    checkpoints: CHECKPOINTS, interval: { method: "approximate-pair-wilson-v1", z: 2.4, maximumWidth: 300 },
    node: "v22.23.0", arch: "arm64", platform: "darwin", cpu: "Apple M5 Pro", cpuCount: 15, concurrency: 8,
    source: Object.fromEntries(MANIFEST_SOURCES.map((file) => [file, inventory[file]])),
  };
  assert.deepEqual(manifest, expected, `${level} manifest`);
}

function repetitionKey(board: Board, position: Position) {
  const [placement, side, castling] = board.toFEN(position).split(" ");
  const legalEp = board.legalMoves(position).some((move) => move.ep);
  return `${placement} ${side} ${castling} ${legalEp ? board.sqName(position.ep!) : "-"}`;
}
function terminal(board: Board, position: Position, repetitions: Map<string, number>) {
  if (board.legalMoves(position).length === 0)
    return board.inCheck(position, position.turn)
      ? { whiteScore: position.turn === "w" ? 0 : 1, reason: "checkmate" }
      : { whiteScore: 0.5, reason: "stalemate" };
  if (position.halfmove >= 100) return { whiteScore: 0.5, reason: "fifty-move-rule" };
  if ((repetitions.get(repetitionKey(board, position)) ?? 0) >= 3)
    return { whiteScore: 0.5, reason: "threefold-repetition" };
  if (board.insufficientMaterial(position.board)) return { whiteScore: 0.5, reason: "insufficient-material" };
  return null;
}
function gameAudit(board: Board, game: Json, level: Level, pair: number, color: "w" | "b") {
  const seed = (0x20260912 + pair * 7919) >>> 0;
  const expected = { protocol: PROTOCOL, opponentVersion: 1, level, morphyColor: color, seed, opening: [], maxPlies: 1000, opponent: { ...IDENTITY, seed } };
  const fields = [...Object.keys(expected), "moves", "fen", "terminal", "resultReason", "score", "elapsedMs", "morphyMs", "classicMs"];
  assert.deepEqual(Object.keys(game).sort(), fields.sort(), "Match field set");
  for (const [key, value] of Object.entries(expected)) assert.deepEqual(game[key], value, `Match ${level}/${pair}/${color} ${key}`);
  assert.ok(Array.isArray(game.moves) && game.moves.length > 0 && game.moves.length <= 1000);
  const moves: unknown[] = game.moves;
  for (const field of ["elapsedMs", "morphyMs", "classicMs"])
    assert.ok(number(game[field], field) >= 0, field);
  assert.ok(number(game.elapsedMs, "elapsed") > 0);
  assert.ok(number(game.elapsedMs, "elapsed") + 1e-6 >= number(game.morphyMs, "Opponent time") + number(game.classicMs, "Classic time"), "Engine timings exceed total elapsed time");
  let position = board.START();
  const repetitions = new Map([[repetitionKey(board, position), 1]]);
  for (const [ply, san] of moves.entries()) {
    assert.equal(terminal(board, position, repetitions), null, `Move after game end at ply ${ply}`);
    assert.equal(typeof san, "string");
    const legal = board.legalMoves(position);
    const matching = legal.filter((move) => board.sanFor(position, move, board.applyMove(position, move)) === san);
    assert.equal(matching.length, 1, `Illegal/ambiguous SAN ${String(san)} at ply ${ply}`);
    position = board.applyMove(position, matching[0]);
    const key = repetitionKey(board, position);
    repetitions.set(key, (repetitions.get(key) ?? 0) + 1);
  }
  const result = terminal(board, position, repetitions);
  const score = (result === null ? null : color === "w" ? result.whiteScore : 1 - result.whiteScore) as Score;
  const reason = result?.reason ?? "unresolved-ply-bound";
  assert.equal(game.fen, board.toFEN(position), "Final FEN");
  assert.equal(game.terminal, result !== null, "Terminal flag");
  assert.equal(game.resultReason, reason, "Terminal reason");
  assert.equal(game.score, score, "Player-relative score");
  if (result === null) assert.equal(moves.length, 1000, "Early unresolved termination");
  return { score, reason, plies: moves.length };
}
function logsAudit(root: string, level: Level, files: Map<string, Json>, checkpoints: number[], scores: Score[]) {
  const directory = join(root, "logs");
  const expectedLogs = Array.from({ length: files.size / 2 }, (_, pair) => `${PLAYER}-${level}-pair-${String(pair).padStart(4, "0")}.log`);
  assert.deepEqual(readdirSync(directory).filter((name) => name.startsWith(`${PLAYER}-${level}-pair-`)).sort(), expectedLogs);
  const hashes: Record<string, string> = {};
  const initName = `${PLAYER}-${level}-init.log`;
  const initBytes = readFileSync(join(directory, initName));
  hashes[initName] = hash(initBytes);
  const initLines = initBytes.toString().trim().split("\n");
  assert.equal(initLines.length, 2, "Init log fields");
  assert.deepEqual(JSON.parse(initLines[0]), { initialized: true, level, protocol: PROTOCOL, manifest: join(root, PLAYER, `${level}-manifest.json`) });
  assert.match(initLines[1], /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \+06$/);
  const lines: Json[] = [];
  for (const filename of expectedLogs) {
    const bytes = readFileSync(join(directory, filename));
    hashes[filename] = hash(bytes);
    const rawLines = bytes.toString().trim().split("\n");
    assert.equal(rawLines.length, 4, `${filename}: start, two games, successful end`);
    const pair = Number(filename.match(/pair-(\d+)/)![1]);
    assert.ok(rawLines[0].includes(` +06 START pair=${pair} worker_pid=`));
    assert.match(rawLines[0], /worker_pid=\d+$/);
    assert.ok(rawLines[3].endsWith(` +06 END pair=${pair} exit=0`));
    const entries = rawLines.slice(1, 3).map((line) => object(JSON.parse(line), filename));
    assert.equal(entries.length, 2, `${filename}: two color games`);
    for (const entry of entries) assert.equal(entry.pair, Number(filename.match(/pair-(\d+)/)![1]), "Worker log pair identity");
    lines.push(...entries);
  }
  assert.equal(lines.length, files.size, `${level}: worker log matches`);
  const seen = new Set<string>();
  for (const line of lines) {
    const filename = `${level}-${String(line.pair).padStart(4, "0")}-${line.morphyColor}.json`;
    assert.ok(!seen.has(filename), `Duplicate log: ${filename}`); seen.add(filename);
    const game = files.get(filename); assert.ok(game, `Unexpected worker log: ${filename}`);
    const expected = {
      protocol: PROTOCOL, opponentVersion: 1, level, pair: line.pair, morphyColor: game.morphyColor,
      score: game.score, resultReason: game.resultReason, plies: (game.moves as unknown[]).length,
      elapsedMs: game.elapsedMs, morphyMs: game.morphyMs, classicMs: game.classicMs,
    };
    assert.deepEqual(line, expected, filename);
  }

  for (const checkpoint of checkpoints) {
    const filename = `${PLAYER}-${level}-${checkpoint}-verify.log`;
    const text = readFileSync(join(directory, filename), "utf8");
    const summaries = text.trim().split("\n").filter(Boolean).map((line) => object(JSON.parse(line), filename));
    assert.equal(summaries.length, checkpoint, filename);
    summaries.forEach((summary, index) => compareSummary(summary, statistics(scores.slice(0, 2 * (index + 1)), level), `${filename}:${index + 1}`));
    hashes[filename] = hash(text);
    const first = checkpoint === 50 ? 0 : checkpoint / 2;
    const scheduleName = `${PLAYER}-${level}-${first}-${checkpoint - 1}-schedule.log`;
    const schedule = readFileSync(join(directory, scheduleName), "utf8");
    const scheduleLines = schedule.trim().split("\n");
    assert.equal(scheduleLines.length, 3, `${scheduleName}: complete schedule`);
    assert.ok(scheduleLines[0].includes(` +06 BEGIN player=${PLAYER} level=${level} pairs=${first}..${checkpoint - 1} protocol=${PROTOCOL} concurrency=8 scheduler_pid=`));
    assert.match(scheduleLines[0], /scheduler_pid=\d+$/);
    assert.ok(scheduleLines[1].endsWith(" +06 WORKERS_DONE"));
    assert.ok(scheduleLines[2].endsWith(` +06 VERIFIED checkpoint=${checkpoint}`));
    hashes[scheduleName] = hash(schedule);
  }
  return hashes;
}
function selfTests(board: Board) {
  const balanced = statistics(Array<Score>(100).fill(0.5), "club");
  assert.equal(balanced.rating, 1350); assert.equal(balanced.fixedRating, 1350); assert.ok(balanced.eligible);
  assert.ok(Math.abs(balanced.lower! + balanced.upper! - 2700) < 1e-9);
  assert.equal(statistics(Array<Score>(100).fill(1), "casual").eligible, false);
  assert.equal(statistics(Array<Score>(100).fill(0), "casual").eligible, false);
  assert.throws(() => statistics([2 as Score, 0], "club"));
  const high = statistics([...Array<Score>(60).fill(1), ...Array<Score>(40).fill(0)], "club");
  const low = statistics([...Array<Score>(40).fill(1), ...Array<Score>(60).fill(0)], "club");
  assert.ok(Math.abs(high.rating! + low.rating! - 2700) < 1e-9);
  assert.ok(Math.abs(high.lower! + low.upper! - 2700) < 1e-9);
  assert.equal(statistics([null, ...Array<Score>(99).fill(0.5)], "club").eligible, false);
  const history = ["f3", "e5", "g4", "Qh4#"];
  let position = board.START();
  for (const san of history) position = board.applyMove(position, board.legalMoves(position).find((m) => board.sanFor(position, m, board.applyMove(position, m)) === san)!);
  const seed = 0x20260912;
  const game = { protocol: PROTOCOL, opponentVersion: 1, level: "casual", morphyColor: "w", seed, opening: [], maxPlies: 1000,
    opponent: { ...IDENTITY, seed }, moves: history, fen: board.toFEN(position), terminal: true, resultReason: "checkmate", score: 0, elapsedMs: 10, morphyMs: 3, classicMs: 3 };
  assert.equal(gameAudit(board, game, "casual", 0, "w").score, 0);
  for (const mutation of [{ score: 1 }, { fen: "wrong" }, { seed: 9 }, { moves: [...history, "a3"] }, { elapsedMs: 1 }, { morphyMs: -1 }, { classicMs: Infinity }, { terminal: false }, { score: null, resultReason: "unresolved-ply-bound", terminal: false }])
    assert.throws(() => gameAudit(board, { ...game, ...mutation }, "casual", 0, "w"));
  const cycle = ["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1", "Ng8"];
  position = board.START();
  for (const san of cycle) position = board.applyMove(position, board.legalMoves(position).find((m) => board.sanFor(position, m, board.applyMove(position, m)) === san)!);
  assert.equal(gameAudit(board, { ...game, moves: cycle, fen: board.toFEN(position), score: 0.5, resultReason: "threefold-repetition" }, "casual", 0, "w").score, 0.5);
  assert.equal(repetitionKey(board, board.fromFEN("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2")).endsWith("d6"), true);
  assert.equal(repetitionKey(board, board.fromFEN("4k3/8/8/r2pP2K/8/8/8/8 w - d6 0 2")).endsWith("-"), true);
  packSelfTests();
  return "passed: pack canonical bytes/raw hashes/line hashes/order mutations; estimator symmetry/bounds/unresolved, legal mate/repetition, tampered score/FEN/seed/post-terminal/timing, legal and pinned en-passant";
}

/** Pack line hashes include the trailing newline, per this run's explicit pack contract. */
function packAudit(directory: string, evidence: string, gameHashes: Record<string, string>) {
  const packed = readFileSync(join(directory, "games.jsonl.gz"));
  const mappingBytes = readFileSync(join(directory, "match-map.json"));
  const mapping = object(JSON.parse(mappingBytes.toString()), "Match map");
  assert.deepEqual(Object.keys(mapping).sort(), ["games", "order", "schemaVersion"]);
  assert.equal(mapping.schemaVersion, 1);
  assert.equal(mapping.order, "source-filename-ascending");
  assert.ok(Array.isArray(mapping.games));
  const text = gunzipSync(packed).toString("utf8");
  assert.ok(text.endsWith("\n"), "JSONL trailing newline");
  const lines = text.slice(0, -1).split("\n");
  const names = Object.keys(gameHashes).sort();
  assert.equal(lines.length, names.length);
  assert.equal(mapping.games.length, names.length);
  for (const [index, name] of names.entries()) {
    const entry = object(mapping.games[index], "Match mapping");
    const raw = readFileSync(join(evidence, name));
    const game = object(JSON.parse(raw.toString()), name);
    assert.equal(hash(raw), gameHashes[name], "Raw game changed after replay");
    assert.equal(lines[index], JSON.stringify(game), "Exact canonical JSON line");
    assert.deepEqual(JSON.parse(lines[index]), game);
    assert.deepEqual(entry, {
      line: index + 1, source: name, sha256: hash(raw), jsonlSha256: hash(`${lines[index]}\n`),
      pair: Number(name.match(/-(\d{4})-/)![1]), morphyColor: game.morphyColor, seed: game.seed,
    });
  }
  return { games: names.length, gamesGzipSha256: hash(packed), matchMapSha256: hash(mappingBytes), canonicalLineHashIncludesNewline: true };
}

function packSelfTests() {
  const directory = mkdtempSync(join(tmpdir(), "roster-audit-pack-"));
  try {
    const name = "casual-0000-w.json";
    const game = { morphyColor: "w", seed: 0x20260912, moves: ["e4"] };
    const raw = JSON.stringify(game, null, 2) + "\n";
    const line = JSON.stringify(game) + "\n";
    const entry = { line: 1, source: name, sha256: hash(raw), jsonlSha256: hash(line), pair: 0, morphyColor: "w", seed: game.seed };
    const writeMap = (record: object) => writeFileSync(join(directory, "match-map.json"), JSON.stringify({ schemaVersion: 1, order: "source-filename-ascending", games: [record] }));
    writeFileSync(join(directory, name), raw);
    writeFileSync(join(directory, "games.jsonl.gz"), gzipSync(line));
    writeMap(entry);
    assert.equal(packAudit(directory, directory, { [name]: hash(raw) }).games, 1);
    for (const mutation of [{ line: 2 }, { source: "casual-0000-b.json" }, { sha256: "wrong" }, { jsonlSha256: hash(line.trimEnd()) }, { seed: 1 }]) {
      writeMap({ ...entry, ...mutation });
      assert.throws(() => packAudit(directory, directory, { [name]: hash(raw) }));
    }
    writeMap(entry);
    writeFileSync(join(directory, "games.jsonl.gz"), gzipSync(raw));
    assert.throws(() => packAudit(directory, directory, { [name]: hash(raw) }));
    writeFileSync(join(directory, "games.jsonl.gz"), gzipSync(line));
    writeFileSync(join(directory, name), raw + " ");
    assert.throws(() => packAudit(directory, directory, { [name]: hash(raw) }));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

async function main() {
  const [rootText, playerText, outputText, mode, packText] = process.argv.slice(2);
  assert.equal(playerText, PLAYER);
  assert.ok(rootText && outputText && (mode === undefined || mode === "--self-test" || (mode === "--pack" && !!packText)), "Usage: audit.ts RUN_ROOT PLAYER OUTPUT_JSON [--self-test | --pack PACK_DIRECTORY]");
  const root = resolve(rootText), output = resolve(outputText);
  const frozen = sourceAudit(root);
  const board: Board = await import(pathToFileURL(join(root, "frozen/src/engine/board.ts")).href);
  const selfTest = selfTests(board);
  if (mode === "--self-test") { console.log(JSON.stringify({ selfTest, frozenFiles: frozen.files, archiveSha256: frozen.archiveSha256 })); return; }
  const evidence = join(root, PLAYER);
  const names = readdirSync(evidence).sort();
  assert.ok(names.every((name) => /^(casual|club|strong)-(?:\d{4}-[wb]|(?:50|100|200)-summary|manifest|summary)\.json$/.test(name)), "Unexpected/temporary evidence file");
  const audited: Record<string, unknown> = {}, gameHashes: Record<string, string> = {}, logHashes: Record<string, string> = {};
  let allEligible = true;
  for (const level of LEVELS) {
    manifestAudit(json(join(evidence, `${level}-manifest.json`)), level, frozen.inventory);
    const matchNames = names.filter((name) => new RegExp(`^${level}-\\d{4}-[wb]\\.json$`).test(name));
    const pairCount = matchNames.length / 2;
    assert.ok(CHECKPOINTS.includes(pairCount), `${level}: game count must be a declared checkpoint`);
    const expectedNames = Array.from({ length: pairCount }, (_, pair) => ["w", "b"].map((color) => `${level}-${String(pair).padStart(4, "0")}-${color}.json`)).flat().sort();
    assert.deepEqual(matchNames, expectedNames, `${level}: no missing, duplicate or extra pairs`);
    const scores: Score[] = [], reasons: Record<string, number> = {}, games = new Map<string, Json>();
    let plies = 0, minPlies = Infinity, maxPlies = 0, elapsedMs = 0, opponentMs = 0, classicMs = 0;
    for (let pair = 0; pair < pairCount; pair++) for (const color of ["w", "b"] as const) {
      const filename = `${level}-${String(pair).padStart(4, "0")}-${color}.json`;
      const path = join(evidence, filename), game = json(path);
      const replay = gameAudit(board, game, level, pair, color);
      games.set(filename, game); gameHashes[filename] = hash(readFileSync(path)); scores.push(replay.score);
      reasons[replay.reason] = (reasons[replay.reason] ?? 0) + 1;
      plies += replay.plies; minPlies = Math.min(minPlies, replay.plies); maxPlies = Math.max(maxPlies, replay.plies);
      elapsedMs += number(game.elapsedMs, filename); opponentMs += number(game.morphyMs, filename); classicMs += number(game.classicMs, filename);
    }
    const checkpoints = CHECKPOINTS.filter((n) => n <= pairCount);
    assert.deepEqual(names.filter((name) => new RegExp(`^${level}-(50|100|200)-summary\\.json$`).test(name)).sort(), checkpoints.map((n) => `${level}-${n}-summary.json`).sort());
    const summaries = checkpoints.map((n) => {
      const result = statistics(scores.slice(0, n * 2), level);
      compareSummary(json(join(evidence, `${level}-${n}-summary.json`)), result, `${level}/${n}`);
      return result;
    });
    const firstEligible = summaries.find((summary) => summary.eligible);
    assert.equal(pairCount, firstEligible?.pairs ?? 200, `${level}: stop at first eligible checkpoint; otherwise exhaust 200`);
    const final = summaries.at(-1)!;
    compareSummary(json(join(evidence, `${level}-summary.json`)), final, `${level}/final`);
    allEligible &&= final.eligible;
    Object.assign(logHashes, logsAudit(root, level, games, checkpoints, scores));
    audited[level] = { checkpoints: summaries, acceptedFixedRating: final.fixedRating, reasons, plies, minPlies, maxPlies, elapsedMs, opponentMs, classicMs };
    console.log(`${level}: independently replayed ${scores.length} games / ${plies} plies; fixed ${final.fixedRating}`);
  }
  // Verify source a second time after replay so the audit itself cannot straddle a source mutation.
  for (const [file, expected] of Object.entries(frozen.inventory))
    assert.equal(hash(readFileSync(join(root, "frozen", file))), expected, `Source changed during audit: ${file}`);
  const result = {
    schemaVersion: 1, auditDateBDT: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
    frozenCommit: COMMIT, archiveSha256: frozen.archiveSha256, inventorySha256: frozen.inventorySha256,
    frozenFilesVerified: frozen.files, player: PLAYER, protocol: PROTOCOL, selfTest, eligibleForRatedIntegration: allEligible,
    pack: mode === "--pack" ? packAudit(resolve(packText!), evidence, gameHashes) : null,
    totalGames: Object.keys(gameHashes).length, levels: audited, gameHashes, logHashes,
    limitations: ["SAN replay checks legal outcomes, not a replay of nondeterministic elapsed-time search decisions.", "Aggregate timings are finite and bounded by total game elapsed time; per-move timing and worker concurrency are not recorded in match JSON.", "Practice Ratings are relative to the frozen Classic anchors and do not establish human/FIDE strength or perceived style."],
  };
  writeFileSync(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ complete: true, totalGames: result.totalGames, eligibleForRatedIntegration: allEligible, output }));
}
await main();
