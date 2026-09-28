import { savedSession, installReviewProbe, workerReviews } from "./saved-session";
import { enterPlay } from "./enter-play";
import { test, expect } from "@playwright/test";
import { freshSession, reduceSession } from "../../src/game/state";
import { morphyConfig } from "../../src/engine/opponents";
import { observeInjectedMate } from "./mate-observer";

const saved = savedSession;

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
        if (!localStorage.getItem("chess-prodigy-state-v7"))
          localStorage.setItem("chess-prodigy-state-v7", JSON.stringify(value));
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
    await enterPlay(page);
    if (opponent === "Classic")
      await page.getByRole("button", { name: "Start", exact: true }).click();
    await page.evaluate(observeInjectedMate);
    await page.getByRole("button", { name: "a2, white pawn", exact: true }).click();
    await page.getByRole("button", { name: "a3, empty", exact: true }).click();
    await expect.poll(async () => (await saved(page)).game.hist.length).toBe(2);
    await expect
      .poll(async () => (await workerReviews(page, (await saved(page)).game.id)).length)
      .toBeGreaterThan(0);
    expect(await page.evaluate(() => Reflect.get(window, "__opponentInjections"))).toBeGreaterThan(
      0,
    );
    // 8888 would render as White mates. Observe accepted live coaching, not only worker output.
    await expect(page.locator(".evalbar")).not.toHaveAttribute("aria-label", /pending|mates/);
    expect(await page.evaluate(() => Reflect.get(window, "__acceptedInjectedMate"))).toBe(false);
    const before = await saved(page);
    expect(before.game.opponent.id).toBe(opponent === "Classic" ? "classic" : "attack-development");
    for (const evaluation of (await workerReviews(page, before.game.id)) as Array<{
      score: number;
      review: { purpose: string };
    }>) {
      expect(evaluation.score).not.toBe(8888);
      expect(evaluation.review.purpose).toBe("neutral-review");
    }
    const legacy = structuredClone(before);
    legacy.preferences.coach = false;
    legacy.game.evals = { 0: { score: 8888, best: null } };
    for (const entry of legacy.game.hist) {
      entry.ann = "!";
      entry.better = "d4";
    }
    // Seed after the old document closes, so pagehide cannot overwrite the fixture.
    await page.addInitScript((value) => {
      localStorage.removeItem("chess-prodigy-state-v9");
      localStorage.setItem("chess-prodigy-state-v7", JSON.stringify(value));
    }, legacy);
    await page.reload();
    await enterPlay(page);
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
    expect(
      new Set((await workerReviews(page, recomputed.game.id)).map((value) => value.review.position))
        .size,
    ).toBe(recomputed.game.hist.length + 1);
    expect(
      (await workerReviews(page, recomputed.game.id)).every(
        (e: unknown) =>
          (e as { review?: { purpose: string } }).review?.purpose === "neutral-review",
      ),
    ).toBe(true);
  });

// Observe real review output; compact authority intentionally omits its derived cache.
test.beforeEach(async ({ context }) => installReviewProbe(context));
