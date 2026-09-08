import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { freshSession, reduceSession } from "../../src/game/state";
import { legalMoves } from "../../src/engine/board";

test("new-game warning previews the loss and offers a safe return", async ({ page }, info) => {
  const now = Date.now();
  let session = freshSession(now, "warning-preview");
  for (let i = 0; i < 2; i++) {
    session = reduceSession(session, {
      type: "move",
      move: legalMoves(session.game.st)[0],
      book: false,
      now,
    });
  }
  session.rating.rating = 1500;
  session.rating.peak = 1500;
  await page.addInitScript((snapshot) => {
    if (!localStorage.getItem("chess-prodigy-state-v1")) {
      localStorage.setItem("chess-prodigy-state-v1", JSON.stringify(snapshot));
    }
  }, session);
  await page.goto("/");
  await page.getByRole("button", { name: "New game", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New game", exact: true });
  await expect(dialog).toContainText("You will lose 28 displayed rating points: 1500 → 1472.");
  await expect(
    dialog.getByRole("button", { name: "Abandon and start", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(scan.violations).toEqual([]);
  await page.screenshot({ path: info.outputPath("abandonment-warning.png"), fullPage: true });
  await dialog.getByRole("button", { name: "Keep playing", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const read = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("chess-prodigy-state-v1")!));
  expect((await read()).rating.rating).toBe(1500);
  expect((await read()).game.id).toBe("warning-preview");
  await page.getByRole("button", { name: "New game", exact: true }).click();
  await dialog.getByRole("button", { name: "Abandon and start", exact: true }).click();
  await expect.poll(async () => Math.round((await read()).rating.rating)).toBe(1472);
  expect((await read()).rating.games).toBe(1);
  await page.reload();
  await expect.poll(async () => (await read()).rating.games).toBe(1);
});
