// @vitest-environment node
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { loadSavedState, SAVE_KEY } from "../../src/storage/store";
import { saveGuestProgress, loadGuestHistory } from "../../src/storage/history";
import { opponentPracticeRating } from "../../src/rating/opponents";
import { CLASSIC } from "../../src/engine/opponents";
import type { Level } from "../../src/engine/types";
import manifest from "../fixtures/recovery-generations/manifest.json";

for (const record of manifest.generations) {
  for (const [level, expectedRating] of [
    ["casual", 900],
    ["club", 1350],
    ["strong", 1800],
  ] as [Level, number][]) {
    it(`migrates historical v${record.generation} ${level} terminal receipt unchanged`, () => {
      const raw = readFileSync(
        new URL(
          `../fixtures/recovery-generations/v${record.generation}-${level}.json`,
          import.meta.url,
        ),
        "utf8",
      );
      expect(createHash("sha256").update(raw).digest("hex")).toBe(record.fixtures[level]);
      const original = JSON.parse(raw);
      const key = `chess-prodigy-state-v${record.generation}`;
      const data = new Map([[key, raw]]);
      const storage = {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => {
          data.set(key, value);
        },
      };
      const loaded = loadSavedState(storage, original.game.clockAt + 1, "fallback");
      expect(loaded.status).toBe("saved");
      expect(loaded.session.game.hist.map((entry) => entry.san)).toEqual([
        "f3",
        "e5",
        "g4",
        "Qh4#",
      ]);
      expect(opponentPracticeRating(CLASSIC, level)).toBe(expectedRating);
      expect(loaded.session.game.ratingApplied).toEqual(original.game.ratingApplied);
      expect(loaded.session.rating).toEqual(original.rating);
      expect(saveGuestProgress(storage, loaded.session)).toBe(true);
      const reloaded = loadSavedState(storage, original.game.clockAt + 2, "fallback");
      expect(reloaded.session.game.ratingApplied).toEqual(original.game.ratingApplied);
      expect(reloaded.session.rating).toEqual(original.rating);
      expect(loadGuestHistory(storage).games[0]).toMatchObject({
        rated: true,
        moves: ["f3", "e5", "g4", "Qh4#"],
      });
      expect(data.get(key)).toBe(raw);
      data.set(SAVE_KEY, "broken-current");
      expect(loadSavedState(storage, original.game.clockAt + 3, "fallback").status).toBe("corrupt");
      expect(data.get(SAVE_KEY)).toBe("broken-current");
    });
  }
}
