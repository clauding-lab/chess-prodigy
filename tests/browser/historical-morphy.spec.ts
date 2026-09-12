import { expect, test, type Page } from "@playwright/test";
import { freshSession, reduceSession } from "../../src/game/state";
import { ratedMorphyConfig } from "../../src/engine/opponents";
import { applyMove, legalMoves, sanFor } from "../../src/engine/board";
import { SAVE_KEY, MEASURED_SAVE_KEY } from "../../src/storage/store";
import type { Session } from "../../src/game/types";
import { enterPlay } from "./enter-play";

const saved = (page: Page): Promise<Session> =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
async function move(page: Page, from: string, to: string) {
  await page.getByRole("button", { name: new RegExp(`^${from},`) }).click();
  await page.getByRole("button", { name: new RegExp(`^${to},`) }).click();
}

for (const color of ["White", "Black"] as const)
  test(`historical selection as ${color} uses recorded repertoire and resumes its exact configuration`, async ({
    page,
  }, info) => {
    test.skip(
      process.env.VITE_PERSONALITY_BETA !== "true",
      "New historical selection is default-off.",
    );
    await page.goto("/");
    await page.getByRole("button", { name: "Play Paul Morphy", exact: true }).click();
    const setup = page.getByRole("dialog", { name: "New game" });
    await expect(setup).toContainText("247 validated games");
    await expect(setup.getByRole("button", { name: "Strong 1775", exact: true })).toBeVisible();
    await setup.getByRole("button", { name: "Casual 1275", exact: true }).click();
    await setup.getByRole("button", { name: color, exact: true }).click();
    await setup.getByRole("button", { name: "No clock", exact: true }).click();
    await setup.getByRole("button", { name: "Start", exact: true }).click();
    if (color === "White") await move(page, "e2", "e4");
    await expect
      .poll(async () => (await saved(page)).game.hist.length)
      .toBe(color === "White" ? 2 : 1);
    const before = await saved(page);
    expect(before.game.opponent).toMatchObject({
      id: "attack-development",
      version: 3,
      engine: "historical-v1",
    });
    expect(before.game.rated).toBe(true);
    if (color === "Black") expect(before.game.hist[0].san).toBe("e4");
    else expect(["e5", "Nc6", "c5", "e6"]).toContain(before.game.hist[1].san);
    await page.reload();
    await expect(page.getByRole("button", { name: "Resume game", exact: true })).toBeVisible();
    await enterPlay(page);
    expect((await saved(page)).game.opponent).toEqual(before.game.opponent);
    expect((await saved(page)).game.hist.map((entry) => entry.san)).toEqual(
      before.game.hist.map((entry) => entry.san),
    );
    expect((await saved(page)).rating).toEqual(before.rating);
    await page.screenshot({
      path: info.outputPath(`historical-${color}-${info.project.name}.png`),
      fullPage: true,
    });
  });

for (const switchToCurrent of [false, true])
  test(`version-2 save migration preserves its receipt and ${switchToCurrent ? "explicit selection chooses version 3" : "rematch keeps version 2"}`, async ({
    page,
  }, info) => {
    const now = Date.now();
    let session = reduceSession(freshSession(now, "initial"), {
      type: "new",
      now,
      id: "older-measured-morphy",
      setup: { playerColor: "w", level: "strong", time: "none", opponent: ratedMorphyConfig(91) },
    });
    session.preferences.coach = false;
    for (const san of ["e4", "e5"]) {
      const candidate = legalMoves(session.game.st).find(
        (m) => sanFor(session.game.st, m, applyMove(session.game.st, m)) === san,
      )!;
      session = reduceSession(session, { type: "move", move: candidate, book: true, now });
    }
    // An earlier completed rated game supplies a receipt that migration must not reprice.
    session = reduceSession(session, { type: "resign", now });
    const receipt = session.game.ratingApplied;
    const previousRating = session.rating;
    const raw = JSON.stringify(session);
    await page.route(
      "**/api/test-migration-seed",
      (route) =>
        route.fulfill({
          contentType: "text/html",
          body: "<!doctype html><title>Migration fixture</title>",
        }),
      { times: 1 },
    );
    await page.goto("/api/test-migration-seed");
    await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
      key: MEASURED_SAVE_KEY,
      raw,
    });
    await page.goto("/");
    await enterPlay(page);
    const migrated = await saved(page);
    expect(migrated.version).toBe(2);
    expect(migrated.game.id).toBe(session.game.id);
    expect(migrated.game.opponent).toEqual(session.game.opponent);
    expect(migrated.game.ratingApplied).toEqual(receipt);
    expect(migrated.rating).toEqual(previousRating);
    expect(await page.evaluate((key) => localStorage.getItem(key), MEASURED_SAVE_KEY)).toBe(raw);
    const rematch = page
      .getByRole("dialog", { name: "Resignation" })
      .getByRole("button", { name: "Rematch", exact: true });
    if (process.env.VITE_PERSONALITY_BETA !== "true") {
      await expect(rematch).toBeDisabled();
      return;
    }
    await rematch.click();
    const setup = page.getByRole("dialog", { name: "New game" });
    await expect(setup).toContainText("This rematch keeps the earlier opponent");
    await expect(setup.getByRole("button", { name: "Strong 1825", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    if (switchToCurrent) {
      await setup.getByRole("button", { name: "Paul Morphy", exact: true }).click();
      await expect(setup).not.toContainText("This rematch keeps the earlier opponent");
      await expect(setup.getByRole("button", { name: "Strong 1775", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    }
    await page.screenshot({
      path: info.outputPath(
        `rematch-${switchToCurrent ? "current" : "earlier"}-${info.project.name}.png`,
      ),
      fullPage: true,
    });
    await setup.getByRole("button", { name: "Start", exact: true }).click();
    const next = await saved(page);
    expect(next.game.opponent.version).toBe(switchToCurrent ? 3 : 2);
    expect(next.game.id).not.toBe(session.game.id);
    expect(next.rating).toEqual(previousRating);
    expect(await page.evaluate((key) => localStorage.getItem(key), MEASURED_SAVE_KEY)).toBe(raw);
  });
