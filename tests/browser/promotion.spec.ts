import { enterPlay } from "./enter-play";
import { test, expect } from "@playwright/test";
import { freshSession, reduceSession } from "../../src/game/state";
import { legalMoves, sanFor, applyMove } from "../../src/engine/board";
function promotionGame(now: number) {
  let s = freshSession(now, "promotion");
  s = reduceSession(s, {
    type: "new",
    setup: { playerColor: "w", level: "club", time: "5+0" },
    now,
    id: "promotion-game",
  });
  for (const san of ["a4", "h5", "a5", "h4", "a6", "h3", "axb7", "hxg2"]) {
    const move = legalMoves(s.game.st).find(
      (m) => sanFor(s.game.st, m, applyMove(s.game.st, m)) === san,
    );
    if (!move) throw new Error("Fixture move is not legal: " + san);
    s = reduceSession(s, { type: "move", move, book: false, now });
  }
  return s;
}
test("keyboard chooses an underpromotion from a legally replayed saved game", async ({ page }) => {
  const session = promotionGame(Date.now());
  session.preferences.coach = false;
  await page.addInitScript(
    (s) => localStorage.setItem("chess-prodigy-state-v4", JSON.stringify(s)),
    session,
  );
  await page.goto("/");
  await enterPlay(page);
  await page.getByRole("button", { name: "b7, white pawn" }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Promote to" })).toBeVisible();
  await page.getByRole("button", { name: "Promote to knight" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".movelist")).toContainText("bxa8=N");
  await expect(page.getByRole("dialog", { name: "Promote to" })).toHaveCount(0);
});
test("promotion picker closes on timeout and never commits a late promotion", async ({ page }) => {
  const now = Date.now();
  const session = reduceSession(promotionGame(now - 299000), { type: "tick", now });
  session.preferences.coach = false;
  await page.clock.install({ time: new Date(now) });
  await page.clock.pauseAt(new Date(now));
  await page.addInitScript(
    (s) => localStorage.setItem("chess-prodigy-state-v4", JSON.stringify(s)),
    session,
  );
  await page.goto("/");
  await enterPlay(page);
  await page.getByRole("button", { name: "b7, white pawn" }).click();
  await page.getByRole("button", { name: "a8, black rook" }).click();
  await expect(page.getByRole("dialog", { name: "Promote to" })).toBeVisible();
  await page.clock.fastForward("00:02");
  await expect(page.getByRole("dialog", { name: "Time out" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Promote to queen" })).toHaveCount(0);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("chess-prodigy-state-v4")!).game.hist.length,
    ),
  ).toBe(8);
});
