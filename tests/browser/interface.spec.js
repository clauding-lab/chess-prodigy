import { enterPlay } from "./enter-play";
import { test, expect } from "@playwright/test";
function square(page, name, flipped = false) {
  const i = (8 - Number(name[1])) * 8 + "abcdefgh".indexOf(name[0]);
  return page.locator(".sq").nth(flipped ? 63 - i : i);
}
async function ready(page) {
  await expect(page.locator(".status")).toContainText("Your move");
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeEnabled();
}
test.beforeEach(async ({ page }, info) => {
  if (info.title.startsWith("clock catches"))
    await page.clock.install({ time: new Date("2026-09-05T18:00:00+06:00") });

  await page.goto("/");
  await enterPlay(page);
});
test("new-game choices and time controls fit narrow and zoomed viewports", async ({
  page,
}, info) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 740 });
    await page.evaluate(() => (document.body.style.zoom = "2"));
    const dialog = page.getByRole("dialog", { name: "New game" });
    const names =
      process.env.VITE_PERSONALITY_BETA === "true"
        ? [
            "Classic",
            "Paul Morphy",
            "Mikhail Chigorin",
            "Boris Spassky",
            "Mikhail Tal",
            "Bobby Fischer",
          ]
        : ["Classic"];
    for (const name of names)
      await expect(dialog.getByRole("button", { name, exact: true })).toBeVisible();
    expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await page.screenshot({
      path: `/tmp/chess-r12-setup-${info.project.name}-${width}.png`,
      animations: "disabled",
    });
  }
});
test("board focus survives the engine reply and arrow navigation resumes", async ({ page }) => {
  await page.getByRole("button", { name: "Start", exact: true }).click();
  const pawn = square(page, "e2");
  await pawn.focus();
  await pawn.press("Enter");
  await pawn.press("ArrowUp");
  const target = square(page, "e3");
  await target.press("ArrowUp");
  const landing = square(page, "e4");
  await landing.press("Enter");
  await expect(landing).toBeFocused();
  await ready(page);
  await expect(landing).toBeFocused();
  await landing.press("ArrowRight");
  await expect(square(page, "f4")).toBeFocused();
});
test("recorded games uses its wide dialog and narrow padding", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "Games", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Recorded games" });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((node) => Math.round(node.getBoundingClientRect().width))).toBe(560);
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await dialog.evaluate((node) => getComputedStyle(node).paddingLeft)).toBe("14px");
  expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
});
test("name, both themes, layout and legal play", async ({ page }, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await expect(page).toHaveTitle("Chess Prodigy");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByRole("banner")).toHaveText("Chess Prodigy");
  await expect(page.getByRole("banner").locator("img")).toBeVisible();
  await expect(page.locator(".sq")).toHaveCount(64);
  await square(page, "e2").click();
  await expect(square(page, "e4").locator(".dot")).toBeVisible();
  await square(page, "e4").click();
  await expect(page.locator(".movelist")).toContainText("e4");
  await ready(page);
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("chess-prodigy-state-v8")).game.moves.length,
      ),
    )
    .toBe(2);
  // Some legal book replies (e.g. 1...g6) are unnamed until a later move.
  await expect(page.locator(".opening")).toContainText(
    /Still in the coaching opening|In the coaching opening, no named line yet/,
  );
  await expect(page.locator(".app")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: info.outputPath("dark.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Wooden board", exact: true }).click();
  await expect(page.locator(".app")).toHaveAttribute("data-theme", "wood");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: info.outputPath("wood.png"),
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});
test("Black orientation follows pieces and remains correct after flip", async ({ page }) => {
  await page.getByRole("button", { name: "Black", exact: true }).click();
  await page.getByRole("button", { name: "5 min", exact: true }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await ready(page);
  await expect(page.locator(".playerbar").nth(1)).toContainText("You");
  await expect(page.locator(".sq").last().locator(".pc")).toHaveClass("pc b");
  await expect(page.locator(".clock")).toHaveCount(2);
  await page.getByRole("button", { name: "Flip", exact: true }).click();
  await expect(page.locator(".playerbar").first()).toContainText("You");
  await expect(page.locator(".sq").first().locator(".pc")).toHaveClass("pc b");
});
test("hint voids rating, takeback restores board, review closes safely", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await square(page, "e2").click();
  await square(page, "e4").click();
  await ready(page);
  await page.getByRole("button", { name: "Hint", exact: true }).click();
  await page.getByRole("button", { name: "Show hint", exact: true }).click();
  await expect(page.locator(".status")).toContainText("Unrated game (hint used)");
  await expect(page.locator(".card").filter({ hasText: "Hint:" })).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".movelist")).toContainText("Moves appear here");
  await expect(square(page, "e2").locator(".pc")).toHaveText("♟︎");
  await page.getByRole("button", { name: "Review game", exact: true }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "New game", exact: true }).click();
  await page.getByRole("button", { name: "Forfeit and continue", exact: true }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.locator(".movelist")).toContainText("Moves appear here");
  expect(errors).toEqual([]);
});
test("a rated resignation reports zero applied loss at the floor", async ({ page }) => {
  await page.getByRole("button", { name: "Casual 900", exact: true }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await square(page, "e2").click();
  await square(page, "e4").click();
  await ready(page);
  await page.getByRole("button", { name: "Resign", exact: true }).click();
  await page.locator(".modal").getByRole("button", { name: "Resign", exact: true }).click();
  await expect(page.locator(".result")).toContainText("0-1");
  await expect(page.locator(".result .delta")).toHaveText("+0.0");
  await expect(page.locator(".panel .num")).toHaveText("1400");
  await expect(page.locator(".chip.L")).toHaveText("L +0.0");
});
test("Strong responds to an out-of-book move without browser errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("button", { name: "Strong 1800", exact: true }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await square(page, "a2").click();
  await square(page, "a3").click();
  await ready(page);
  await expect(page.locator(".movelist")).toContainText("a3");
  await expect(page.locator(".status")).toContainText("Your move");
  expect(errors).toEqual([]);
});

test("clock catches up after delayed callbacks and preserves timeout", async ({ page }) => {
  await page.getByRole("button", { name: "5 min", exact: true }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await square(page, "e2").click();
  await square(page, "e4").click();
  await ready(page);
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("chess-prodigy-state-v8")).game.moves.length,
      ),
    )
    .toBe(2);
  await expect(page.locator(".status")).toContainText("Your move");
  await page.getByText("Live", { exact: true }).click();
  const seconds = (text) => text.split(":").reduce((m, s) => m * 60 + Number(s), 0);
  const before = seconds(await page.locator(".clock").nth(1).innerText());
  await page.clock.fastForward("00:10");
  await expect
    .poll(async () => before - seconds(await page.locator(".clock").nth(1).innerText()))
    .toBeGreaterThanOrEqual(10);
  const after = seconds(await page.locator(".clock").nth(1).innerText());
  expect(before - after).toBeLessThanOrEqual(11);
  await page.clock.fastForward("05:00");
  await expect(page.locator(".status")).toContainText("Time out");
  await expect(page.locator(".result")).toContainText("0-1");
  await expect(page.locator(".result .delta")).toHaveText("+0.0");
});
