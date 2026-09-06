import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { Router } from "express";
import { fromNodeHeaders } from "better-auth/node";
import type { ChessAuth } from "./auth.js";
import { ChatError, EphemeralChat } from "./chat.js";
import { freshGame, reduceGame } from "../src/game/state.js";
import type { Game } from "../src/game/types.js";
import type { Move } from "../src/engine/types.js";
import type {
  MultiplayerGame,
  MultiplayerPlayer,
  MultiplayerRating,
  HeadToHead,
} from "../src/multiplayer/types.js";
interface Row {
  id: string;
  creator_id: string;
  white_id: string | null;
  black_id: string | null;
  status: MultiplayerGame["status"];
  revision: number;
  turn_revision: number;
  state_json: string;
  token_hash: string;
  created_at: number;
  expires_at: number;
  turn_started_at: number | null;
  draw_offer_by: string | null;
  white_delta: number | null;
  black_delta: number | null;
}
export interface MultiplayerEvent {
  game_id: string;
  revision: number;
  user_id: string;
  kind: string;
}
export function isMultiplayerEventCurrent(db: Database.Database, event: MultiplayerEvent): boolean {
  const row = db.prepare("SELECT * FROM mp_games WHERE id=?").get(event.game_id) as Row | undefined;
  if (!row || (row.white_id !== event.user_id && row.black_id !== event.user_id)) return false;
  if (event.kind === "started")
    return (
      row.creator_id === event.user_id && (row.status === "active" || row.status === "completed")
    );
  if (event.kind !== "reminder" || row.status !== "active" || row.turn_revision !== event.revision)
    return false;
  const game = JSON.parse(row.state_json) as Game;
  return (game.st.turn === "w" ? row.white_id : row.black_id) === event.user_id;
}
class RequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
function fail(status: number, message: string): never {
  throw new RequestError(status, message);
}
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
export function createMultiplayerRouter(db: Database.Database, auth: ChessAuth, baseURL: string) {
  db.exec(`
 CREATE TABLE IF NOT EXISTS mp_games (
 id TEXT PRIMARY KEY, creator_id TEXT NOT NULL REFERENCES user(id),white_id TEXT REFERENCES user(id),black_id TEXT REFERENCES user(id),
 status TEXT NOT NULL,revision INTEGER NOT NULL,turn_revision INTEGER NOT NULL DEFAULT 0,state_json TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,
 created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,turn_started_at INTEGER,draw_offer_by TEXT,
 white_delta REAL,black_delta REAL);
 CREATE INDEX IF NOT EXISTS mp_games_white ON mp_games(white_id,created_at);
 CREATE INDEX IF NOT EXISTS mp_games_black ON mp_games(black_id,created_at);
 CREATE INDEX IF NOT EXISTS mp_games_creator ON mp_games(creator_id,created_at);
 CREATE TABLE IF NOT EXISTS mp_ratings(user_id TEXT PRIMARY KEY REFERENCES user(id),rating REAL NOT NULL DEFAULT 1200,games INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS mp_pairs(low_id TEXT NOT NULL REFERENCES user(id),high_id TEXT NOT NULL REFERENCES user(id),low_wins INTEGER NOT NULL DEFAULT 0,high_wins INTEGER NOT NULL DEFAULT 0,draws INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(low_id,high_id));
 CREATE TABLE IF NOT EXISTS mp_events(id INTEGER PRIMARY KEY,game_id TEXT NOT NULL REFERENCES mp_games(id),revision INTEGER NOT NULL,user_id TEXT NOT NULL REFERENCES user(id),kind TEXT NOT NULL,due_at INTEGER NOT NULL,UNIQUE(game_id,revision,user_id,kind));
 CREATE INDEX IF NOT EXISTS mp_events_due ON mp_events(due_at);
 CREATE TABLE IF NOT EXISTS mp_limits(user_id TEXT NOT NULL,bucket TEXT NOT NULL,window INTEGER NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(user_id,bucket));
 `);
  const router = Router();
  const chat = new EphemeralChat();
  const origin = new URL(baseURL).origin;
  const rating = (id: string): MultiplayerRating =>
    (db.prepare("SELECT rating,games FROM mp_ratings WHERE user_id=?").get(id) as
      MultiplayerRating | undefined) ?? { rating: 1200, games: 0 };
  const player = (id: string | null): MultiplayerPlayer | null =>
    id
      ? {
          id,
          name: (db.prepare("SELECT name FROM user WHERE id=?").get(id) as { name: string }).name,
          ...rating(id),
        }
      : null;
  function pair(user: string, opponent: string): HeadToHead {
    const [low, high] = [user, opponent].sort();
    const row = db
      .prepare("SELECT low_wins,high_wins,draws FROM mp_pairs WHERE low_id=? AND high_id=?")
      .get(low, high) as { low_wins: number; high_wins: number; draws: number } | undefined;
    return {
      opponent: player(opponent)!,
      wins: row ? (user === low ? row.low_wins : row.high_wins) : 0,
      losses: row ? (user === low ? row.high_wins : row.low_wins) : 0,
      draws: row?.draws ?? 0,
    };
  }
  function view(row: Row, user: string): MultiplayerGame {
    const game = JSON.parse(row.state_json) as Game;
    const opponent = row.white_id === user ? row.black_id : row.white_id;
    return {
      id: row.id,
      revision: row.revision,
      status: row.status === "waiting" && row.expires_at <= Date.now() ? "expired" : row.status,
      creatorId: row.creator_id,
      white: player(row.white_id),
      black: player(row.black_id),
      yourColor: row.white_id === user ? "w" : row.black_id === user ? "b" : null,
      position: game.st,
      moves: game.hist.map((e) => ({ move: e.mv, san: e.san })),
      result: game.over,
      drawOfferBy: row.draw_offer_by,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      turnStartedAt: row.turn_started_at,
      ratingChanges:
        row.white_delta === null ? null : { white: row.white_delta, black: row.black_delta! },
      headToHead: opponent ? pair(user, opponent) : null,
      review: row.status === "completed" ? game : null,
    };
  }
  function owned(id: string, user: string): Row {
    const row = db.prepare("SELECT * FROM mp_games WHERE id=?").get(id) as Row | undefined;
    if (!row || (row.creator_id !== user && row.white_id !== user && row.black_id !== user))
      fail(404, "Game unavailable.");
    return row;
  }
  function event(row: Row, kind: "started" | "reminder", user: string, due: number) {
    db.prepare(
      "INSERT OR IGNORE INTO mp_events(game_id,revision,user_id,kind,due_at) VALUES(?,?,?,?,?)",
    ).run(row.id, kind === "reminder" ? row.turn_revision : row.revision, user, kind, due);
  }
  function reminder(row: Row, game: Game) {
    if (row.status === "active")
      event(
        row,
        "reminder",
        (game.st.turn === "w" ? row.white_id : row.black_id)!,
        row.turn_started_at! + 600_000,
      );
  }
  function save(row: Row) {
    db.prepare(
      "UPDATE mp_games SET white_id=?,black_id=?,status=?,revision=?,turn_revision=?,state_json=?,turn_started_at=?,draw_offer_by=?,white_delta=?,black_delta=? WHERE id=?",
    ).run(
      row.white_id,
      row.black_id,
      row.status,
      row.revision,
      row.turn_revision,
      row.state_json,
      row.turn_started_at,
      row.draw_offer_by,
      row.white_delta,
      row.black_delta,
      row.id,
    );
  }
  function complete(row: Row, game: Game) {
    if (!game.over) return;
    const white = rating(row.white_id!),
      black = rating(row.black_id!);
    const score = game.over.result === "½-½" ? 0.5 : game.over.result === "1-0" ? 1 : 0;
    const delta = 32 * (score - 1 / (1 + 10 ** ((black.rating - white.rating) / 400)));
    const update = db.prepare(
      "INSERT INTO mp_ratings(user_id,rating,games) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET rating=excluded.rating,games=excluded.games",
    );
    update.run(row.white_id, white.rating + delta, white.games + 1);
    update.run(row.black_id, black.rating - delta, black.games + 1);
    const [low, high] = [row.white_id!, row.black_id!].sort();
    const winner = score === 0.5 ? null : score === 1 ? row.white_id : row.black_id;
    db.prepare(
      "INSERT INTO mp_pairs(low_id,high_id,low_wins,high_wins,draws) VALUES(?,?,?,?,?) ON CONFLICT(low_id,high_id) DO UPDATE SET low_wins=low_wins+excluded.low_wins,high_wins=high_wins+excluded.high_wins,draws=draws+excluded.draws",
    ).run(low, high, Number(winner === low), Number(winner === high), Number(winner === null));
    row.white_delta = delta;
    row.black_delta = -delta;
    row.status = "completed";
    row.draw_offer_by = null;
  }
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.get("/leaderboard", (_req, res) => {
    const players = db
      .prepare(
        "SELECT u.name,r.rating,r.games FROM mp_ratings r JOIN user u ON u.id=r.user_id WHERE r.games>0 ORDER BY r.rating DESC,r.games DESC,u.id LIMIT 100",
      )
      .all() as { name: string; rating: number; games: number }[];
    res.json({
      players: players.map((p, i) => ({ ...p, rating: Math.round(p.rating), rank: i + 1 })),
    });
  });
  router.use(async (req, res, next) => {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (
      !session ||
      (req.get("x-chess-account") && req.get("x-chess-account") !== session.user.id)
    ) {
      res.status(401).json({ error: "Sign in to access your games." });
      return;
    }
    if (req.method !== "GET" && req.get("origin") !== origin) {
      res.status(403).json({ error: "Untrusted request origin." });
      return;
    }
    res.locals.userId = session.user.id;
    const bucket = req.path.endsWith("/chat")
      ? "chat"
      : req.method === "GET"
        ? "read"
        : req.path === "/invites"
          ? "invite"
          : req.path === "/join"
            ? "join"
            : "action";
    const window = Math.floor(Date.now() / 60_000);
    const maximum =
      bucket === "chat"
        ? 120
        : bucket === "read"
          ? 180
          : bucket === "invite"
            ? 5
            : bucket === "join"
              ? 20
              : 90;
    const count = db
      .prepare(
        "INSERT INTO mp_limits(user_id,bucket,window,count) VALUES(?,?,?,1) ON CONFLICT(user_id,bucket) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,window=excluded.window RETURNING count",
      )
      .get(session.user.id, bucket, window) as { count: number };
    if (count.count > maximum) {
      res
        .set("Retry-After", "60")
        .status(429)
        .json({ error: "Too many requests. Please wait a minute." });
      return;
    }
    next();
  });
  router.get("/", (_req, res) => {
    const user = res.locals.userId as string;
    const games = db
      .prepare(
        "SELECT * FROM mp_games WHERE creator_id=? OR white_id=? OR black_id=? ORDER BY CASE WHEN status='active' THEN 0 WHEN status='waiting' AND expires_at>? THEN 1 ELSE 2 END,created_at DESC LIMIT 200",
      )
      .all(user, user, user, Date.now()) as Row[];
    const pairs = db
      .prepare("SELECT low_id,high_id FROM mp_pairs WHERE low_id=? OR high_id=?")
      .all(user, user) as { low_id: string; high_id: string }[];
    res.json({
      games: games.map((row) => view(row, user)),
      rating: rating(user),
      opponents: pairs.map((p) => pair(user, p.low_id === user ? p.high_id : p.low_id)),
    });
  });
  router.post("/invites", (req, res) => {
    const body = req.body as Record<string, unknown> | undefined;
    const choice = body?.color ?? "random";
    if (!["w", "b", "random"].includes(choice as string))
      fail(400, "Choose White, Black, or random.");
    const user = res.locals.userId as string;
    const now = Date.now();
    const id = randomUUID();
    const token = randomBytes(32).toString("base64url");
    const color = choice === "random" ? (randomInt(2) ? "w" : "b") : choice;
    db.transaction(() => {
      const open = db
        .prepare(
          "SELECT count(*) AS n FROM mp_games WHERE creator_id=? AND (status='active' OR (status='waiting' AND expires_at>?))",
        )
        .get(user, now) as { n: number };
      if (open.n >= 30) fail(429, "Finish or cancel some invitations before creating more.");
      db.prepare(
        "INSERT INTO mp_games(id,creator_id,white_id,black_id,status,revision,state_json,token_hash,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
      ).run(
        id,
        user,
        color === "w" ? user : null,
        color === "b" ? user : null,
        "waiting",
        0,
        JSON.stringify(freshGame({ playerColor: "w", level: "club", time: "none" }, now, id)),
        hash(token),
        now,
        now + 7 * 86400_000,
      );
    }).immediate();
    res.status(201).json({ id, token });
  });
  router.post("/join", (req, res) => {
    const token = (req.body as Record<string, unknown> | undefined)?.token;
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token))
      fail(404, "Invitation unavailable.");
    const user = res.locals.userId as string;
    const result = db
      .transaction(() => {
        const row = db.prepare("SELECT * FROM mp_games WHERE token_hash=?").get(hash(token)) as
          Row | undefined;
        if (!row) fail(404, "Invitation unavailable.");
        if (row.status === "active" || row.status === "completed") {
          if (row.white_id !== user && row.black_id !== user) fail(404, "Invitation unavailable.");
          return view(row, user);
        }
        if (row.status !== "waiting" || row.expires_at <= Date.now())
          fail(404, "Invitation unavailable.");
        if (row.creator_id === user) return view(row, user);
        if (!row.white_id) row.white_id = user;
        else row.black_id = user;
        row.status = "active";
        row.revision++;
        row.turn_revision = row.revision;
        row.turn_started_at = Date.now();
        const game = JSON.parse(row.state_json) as Game;
        game.revision = row.revision;
        row.state_json = JSON.stringify(game);
        save(row);
        event(row, "started", row.creator_id, Date.now());
        reminder(row, game);
        return view(row, user);
      })
      .immediate();
    res.json(result);
  });
  router.get("/:id", (req, res) =>
    res.json(view(owned(req.params.id, res.locals.userId as string), res.locals.userId as string)),
  );
  router.post("/:id/chat", (req, res) => {
    const user = res.locals.userId as string;
    const row = owned(req.params.id, user);
    if (!row.white_id || !row.black_id || !["active", "completed"].includes(row.status))
      fail(409, "Chat opens after your opponent joins.");
    res.set("Cache-Control", "no-store").json(chat.request(row.id, user, req.body));
  });
  for (const action of ["move", "resign", "draw", "cancel"] as const)
    router.post(`/:id/${action}`, (req, res) => {
      const user = res.locals.userId as string;
      const body = req.body as Record<string, unknown> | undefined;
      if (!Number.isSafeInteger(body?.expectedRevision) || Number(body?.expectedRevision) < 0)
        fail(400, "A valid game revision is required.");
      const result = db
        .transaction(() => {
          const row = owned(req.params.id as string, user);
          if (row.revision !== body!.expectedRevision)
            fail(409, "The game changed. Refresh and try again.");
          if (action === "cancel") {
            if (row.status !== "waiting" || row.creator_id !== user || row.expires_at <= Date.now())
              fail(409, "This invitation cannot be cancelled.");
            row.status = "cancelled";
            row.revision++;
            save(row);
            return view(row, user);
          }
          if (row.status !== "active") fail(409, "This game is not active.");
          let game = JSON.parse(row.state_json) as Game;
          if (action === "move") {
            if ((game.st.turn === "w" ? row.white_id : row.black_id) !== user)
              fail(409, "Wait for your turn.");
            const move = body!.move as Move | undefined;
            if (
              !move ||
              !Number.isInteger(move.from) ||
              !Number.isInteger(move.to) ||
              move.from < 0 ||
              move.from > 63 ||
              move.to < 0 ||
              move.to > 63 ||
              (move.promo !== undefined && !["q", "r", "b", "n"].includes(move.promo))
            )
              fail(400, "Invalid move.");
            const next = reduceGame(game, { type: "move", move, book: false, now: Date.now() });
            if (next === game) fail(400, "Illegal move.");
            game = next;
            row.turn_started_at = Date.now();
            if (row.draw_offer_by !== user) row.draw_offer_by = null;
          } else if (action === "resign")
            game = {
              ...game,
              over: { result: row.white_id === user ? "0-1" : "1-0", reason: "Resignation" },
            };
          else {
            const drawAction = body!.action;
            if (drawAction === "offer") {
              if (row.draw_offer_by) fail(409, "A draw offer is already pending.");
              row.draw_offer_by = user;
            } else if (drawAction === "accept" || drawAction === "decline") {
              if (!row.draw_offer_by || row.draw_offer_by === user)
                fail(409, "There is no opponent draw offer.");
              row.draw_offer_by = null;
              if (drawAction === "accept")
                game = { ...game, over: { result: "½-½", reason: "Draw by agreement" } };
            } else fail(400, "Choose offer, accept, or decline.");
          }
          row.revision++;
          if (action === "move") row.turn_revision = row.revision;
          game.revision = row.revision;
          row.state_json = JSON.stringify(game);
          complete(row, game);
          save(row);
          reminder(row, game);
          return view(row, user);
        })
        .immediate();
      res.json(result);
    });
  router.use(
    (
      error: unknown,
      _req: import("express").Request,
      res: import("express").Response,
      next: import("express").NextFunction,
    ) => {
      if (error instanceof RequestError || error instanceof ChatError)
        res.status(error.status).json({ error: error.message });
      else next(error);
    },
  );
  return Object.assign(router, { closeChat: () => chat.close() });
}
