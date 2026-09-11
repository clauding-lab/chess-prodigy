import { test, expect } from "@playwright/test";
import { freshSession, reduceSession } from "../../src/game/state";
import { morphyConfig } from "../../src/engine/opponents";

const saved = (page: import("@playwright/test").Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("chess-prodigy-state-v2")!));

for (const opponent of ["Classic", "Morphy"] as const)
  test(`native worker ${opponent} scores cannot survive as review, including legacy reload`, async ({
    page,
  }) => {
    if (opponent === "Morphy") {
      const now = Date.now();
      const s = reduceSession(freshSession(now, "initial"), {
        type: "new",
        id: "native-morphy",
        now,
        setup: { playerColor: "w", level: "club", time: "none", opponent: morphyConfig(42) },
      });
      await page.addInitScript((value) => {
        if (!localStorage.getItem("chess-prodigy-state-v2"))
          localStorage.setItem("chess-prodigy-state-v2", JSON.stringify(value));
      }, s);
    }
    await page.addInitScript(() => {
      const NativeWorker = window.Worker;
      let injected = 0;
      Object.defineProperty(window, "__opponentInjections", { get: () => injected });
      window.Worker = class extends NativeWorker {
        constructor(url: string | URL, options?: WorkerOptions) {
          super(url, options);
          // Synthetic contamination at the real worker boundary; production move
          // choice is untouched. This listener runs before the client's listener.
          this.addEventListener("message", (event) => {
            if (event.data.type === "ai" && event.data.ok) {
              event.data.result.score = 8888;
              injected++;
            }
          });
        }
      };
    });
    await page.goto("/");
    if (opponent === "Classic")
      await page.getByRole("button", { name: "Start", exact: true }).click();
    await page.getByRole("button", { name: "a2, white pawn", exact: true }).click();
    await page.getByRole("button", { name: "a3, empty", exact: true }).click();
    await expect.poll(async () => (await saved(page)).game.hist.length).toBe(2);
    await expect.poll(async () => !!(await saved(page)).game.evals[2]?.review).toBe(true);
    expect(await page.evaluate(() => Reflect.get(window, "__opponentInjections"))).toBeGreaterThan(
      0,
    );
    const before = await saved(page);
    expect(before.game.opponent.id).toBe(opponent === "Classic" ? "classic" : "attack-development");
    for (const evaluation of Object.values(before.game.evals) as Array<{
      score: number;
      review: { purpose: string };
    }>) {
      expect(evaluation.score).not.toBe(8888);
      expect(evaluation.review.purpose).toBe("neutral-review");
    }
    const legacy = await page.evaluate(() => {
      const session = JSON.parse(localStorage.getItem("chess-prodigy-state-v2")!);
      session.preferences.coach = false;
      for (const evaluation of Object.values(session.game.evals) as Array<{
        score: number;
        review?: unknown;
      }>) {
        evaluation.score = 8888;
        delete evaluation.review;
      }
      for (const entry of session.game.hist) {
        entry.ann = "!";
        entry.better = "d4";
      }
      return session;
    });
    // Seed after the old document closes, so pagehide cannot overwrite the fixture.
    await page.addInitScript(
      (value) => localStorage.setItem("chess-prodigy-state-v2", JSON.stringify(value)),
      legacy,
    );
    await page.reload();
    await expect(page.getByRole("button", { name: "Off", exact: true })).toBeVisible();
    const migrated = await saved(page);
    expect(migrated.game.opponent).toEqual(before.game.opponent);
    expect(migrated.game.id).toBe(before.game.id);
    expect(migrated.game.hist.map((e: { san: string }) => e.san)).toEqual(
      before.game.hist.map((e: { san: string }) => e.san),
    );
    expect(migrated.rating).toEqual(before.rating);
    expect(migrated.game.evals).toEqual({});
    expect(
      migrated.game.hist.every(
        (e: { ann: unknown; better: unknown }) => e.ann === null && e.better === null,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Off", exact: true }).click();
    await page.getByRole("button", { name: "Review game", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Game review");
    await expect(dialog).not.toContainText("analysing…", { timeout: 15000 });
    const recomputed = await saved(page);
    expect(Object.keys(recomputed.game.evals)).toHaveLength(recomputed.game.hist.length + 1);
    expect(
      Object.values(recomputed.game.evals).every(
        (e: unknown) =>
          (e as { review?: { purpose: string } }).review?.purpose === "neutral-review",
      ),
    ).toBe(true);
  });
