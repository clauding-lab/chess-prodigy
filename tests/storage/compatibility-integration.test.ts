import { expect, it } from "vitest";
import {
  CLASSIC,
  morphyConfig,
  ratedMorphyConfig,
  historicalMorphyConfig,
  plannedMorphyConfig,
  chigorinConfig,
  rosterConfig,
} from "../../src/engine/opponents";
import { freshSession, reduceSession } from "../../src/game/state";
import { loadSavedState } from "../../src/storage/store";
import { saveGuestProgress } from "../../src/storage/history";
import { AccountSync } from "../../src/account/sync";
import { playLine } from "../game/play-line";

const opponents = [
  CLASSIC,
  morphyConfig(7),
  ratedMorphyConfig(7),
  historicalMorphyConfig(7),
  plannedMorphyConfig(7),
  chigorinConfig(7),
  ...(["spassky", "tal", "fischer"] as const).map((id) => rosterConfig(id, 7)),
];
for (const opponent of opponents)
  for (const level of ["casual", "club", "strong"] as const)
    for (const assistance of ["none", "hint", "takeback"] as const)
      it(`${opponent.id}/v${opponent.version} ${level}/${assistance} preserves receipt, rematch and raw pending through guest/account upgrade`, async () => {
        let source = reduceSession(freshSession(0, "seed"), {
          type: "new",
          id: "terminal",
          now: 0,
          setup: { playerColor: "w", level, time: "none", opponent },
        });
        source = playLine(source, ["e4", "e5"], 1);
        if (assistance === "hint") source = reduceSession(source, { type: "hint" });
        if (assistance === "takeback") {
          source = reduceSession(source, { type: "undo", now: 4 });
          source = playLine(source, ["d4", "d5"], 5);
        }
        source = reduceSession(source, { type: "resign", now: 10 });
        const raw = JSON.stringify(source);
        const values = new Map([["chess-prodigy-state-v7", raw]]);
        const storage = {
          getItem: (key: string) => values.get(key) ?? null,
          setItem: (key: string, value: string) => {
            values.set(key, value);
          },
        };
        const loaded = loadSavedState(storage, 11, "unused").session;
        expect(saveGuestProgress(storage, loaded)).toBe(true);
        const resumed = loadSavedState(storage, 12, "unused").session;
        expect(resumed.game.opponent).toEqual(opponent);
        expect(resumed.game.ratingApplied).toEqual(source.game.ratingApplied);
        expect(resumed.rating).toEqual(source.rating);
        expect(values.get("chess-prodigy-state-v7")).toBe(raw);
        if (assistance !== "none" || opponent === opponents[1])
          expect(resumed.game.ratingApplied).toBeNull();
        const rematch = reduceSession(resumed, {
          type: "new",
          id: "rematch",
          now: 13,
          setup: { ...resumed.game.setup, opponent: resumed.game.opponent },
        });
        expect(rematch.game.opponent).toEqual(opponent);
        const pendingRaw = JSON.stringify({
          baseVersion: 8,
          snapshot: source,
          pending: [{ snapshot: source, terminal: true, attempted: true }],
        });
        values.set("chess-prodigy-account-v7:owner", pendingRaw);
        let sent = false;
        const sync = new AccountSync("owner", storage, async (_url, init) => {
          const body = JSON.parse(String(init?.body));
          expect(body.expectedVersion).toBe(8);
          expect(body.snapshot).toEqual(JSON.parse(raw));
          expect(new Headers(init?.headers).get("X-Chess-Rating-Policy")).toBe("7");
          sent = true;
          return Response.json({ version: 9, snapshot: body.snapshot, games: [], updatedAt: null });
        });
        const initial = sync.initialize({
          version: 8,
          snapshot: freshSession(0, "remote"),
          games: [],
          updatedAt: null,
        });
        expect(initial.game.ratingApplied).toEqual(source.game.ratingApplied);
        await sync.flush();
        expect(sent).toBe(true);
        expect(sync.status()).toMatchObject({ state: "idle", pending: 0 });
        expect(values.get("chess-prodigy-account-v7:owner")).toBe(pendingRaw);
        expect(values.get("chess-prodigy-state-v7")).toBe(raw);
        sync.dispose();
      });
