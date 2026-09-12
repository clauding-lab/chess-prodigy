import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { freshSession, reduceSession } from "../../src/game/state";
import { legalMoves } from "../../src/engine/board";
import { SAVE_KEY } from "../../src/storage/store";

test("Home explains the opponents, fits both themes and opens setup only after a choice", async ({
  page,
}, info) => {
  await page.goto("/");
  const home = page.getByRole("main", { name: "Chess Prodigy home" });
  await expect(home).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(home.getByRole("heading", { name: "Classic", exact: true })).toBeVisible();
  if (process.env.VITE_PERSONALITY_BETA === "true") {
    await home.getByText("Who was Paul Morphy?", { exact: true }).click();
    await expect(home.getByText(/An American chess master/)).toBeVisible();
  }
  for (const theme of ["dark", "wood"]) {
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath(`home-${theme}.png`), fullPage: true });
    if (theme === "dark")
      await home.getByRole("button", { name: "Wooden board", exact: true }).click();
  }
  await home.getByRole("button", { name: "Play Classic", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "New game" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(home).toBeVisible();
});

test("a closed timed game expires on Home once before any resumed move", async ({
  page,
  context,
}) => {
  const now = new Date("2026-09-12T13:00:00+06:00");
  await page.clock.install({ time: now });
  let s = reduceSession(freshSession(+now, "initial"), {
    type: "new",
    id: "closed-home",
    now: +now,
    setup: { playerColor: "w", level: "club", time: "5+0" },
  });
  for (let i = 0; i < 2; i++)
    s = reduceSession(s, { type: "move", move: legalMoves(s.game.st)[0], book: false, now: +now });
  s.game.clocks = { w: 1000, b: 300000 };
  await page.addInitScript(
    ({ snapshot, key }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(snapshot));
    },
    { snapshot: s, key: SAVE_KEY },
  );
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Resume game", exact: true })).toBeVisible();
  await page.goto("about:blank");
  await page.clock.setSystemTime(new Date(+now + 5000));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "View result", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Resume game", exact: true })).toHaveCount(0);
  const read = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
  expect((await read()).game.over.reason).toBe("Time out");
  expect((await read()).rating.games).toBe(1);
  await page.reload();
  await expect(page.getByRole("button", { name: "View result", exact: true })).toBeVisible();
  expect((await read()).rating.games).toBe(1);
  await page.getByRole("button", { name: "View result", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Time out", exact: true })).toBeVisible();
  void context;
});
