import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { freshSession, reduceSession } from "../../src/game/state";
import { morphyConfig } from "../../src/engine/opponents";
import { legalMoves, sqName } from "../../src/engine/board";
import type { Session } from "../../src/game/types";

const saved = (page: Page): Promise<Session> =>
  page.evaluate(() => JSON.parse(localStorage.getItem("chess-prodigy-state-v3")!));
function beta(color: "w" | "b" = "w") {
  const now = Date.now();
  const s = reduceSession(freshSession(now, "initial"), {
    type: "new",
    id: `synthetic-morphy-${color}`,
    now,
    setup: { playerColor: color, level: "casual", time: "none", opponent: morphyConfig(4) },
  });
  s.preferences.coach = false;
  return s;
}
async function seed(page: Page, s: Session) {
  await page.addInitScript((value) => {
    if (!localStorage.getItem("chess-prodigy-state-v3"))
      localStorage.setItem("chess-prodigy-state-v3", JSON.stringify(value));
  }, s);
}
async function move(page: Page, from: string, to: string) {
  await page.getByRole("button", { name: new RegExp(`^${from},`) }).click();
  await page.getByRole("button", { name: new RegExp(`^${to},`) }).click();
}

test("new personality selection follows the build flag and keeps keyboard/focus accessibility", async ({
  page,
}, info) => {
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "New game" });
  await expect(dialog.getByRole("button", { name: "Classic", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const morphy = dialog.getByRole("button", { name: "Paul Morphy", exact: true });
  if (process.env.VITE_PERSONALITY_BETA === "true") {
    await morphy.focus();
    await morphy.press("Enter");
    await expect(dialog).toContainText("Attack & development");
    await expect(dialog).toContainText(
      "Rated practice — strength measured against Classic within this app.",
    );
    await expect(dialog.getByRole("button", { name: "Club 1375", exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `/tmp/chess-prodigy-run2/beta-setup-${info.project.name}.png` });
  } else await expect(morphy).toHaveCount(0);
  await dialog.getByRole("button", { name: "Start", exact: true }).click();
  expect((await saved(page)).game.opponent.id).toBe(
    process.env.VITE_PERSONALITY_BETA === "true" ? "attack-development" : "classic",
  );
  if (process.env.VITE_PERSONALITY_BETA === "true") {
    await page.getByRole("button", { name: "Wooden board", exact: true }).click();
    await page.getByRole("button", { name: "New game", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Paul Morphy", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: `/tmp/chess-prodigy-run2/beta-setup-wood-${info.project.name}.png`,
    });
  }
});

for (const color of ["w", "b"] as const)
  test(`saved Morphy ${color} resumes, plays offline, flips and reviews through the native worker`, async ({
    page,
    context,
  }, info) => {
    await seed(page, beta(color));
    await page.goto("/");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    if (color === "w") await move(page, "e2", "e4");
    else {
      await expect.poll(async () => (await saved(page)).game.hist.length).toBe(1);
      await move(page, "e7", "e5");
    }
    const expected = color === "w" ? 2 : 3;
    await expect.poll(async () => (await saved(page)).game.hist.length).toBe(expected);
    await expect(page.locator(".playerbar").first()).toContainText("Paul Morphy · Casual");
    await page.getByRole("button", { name: "Flip", exact: true }).click();
    await expect(page.locator(".playerbar").last()).toContainText("Paul Morphy · Casual");
    const before = await saved(page);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    // Prompt-mode installation does not take control of an already open page.
    // Its active worker controls the next navigation, without forcing a game reload.
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByText("Paul Morphy · Casual", { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    expect((await saved(page)).game.opponent).toEqual(before.game.opponent);
    const legal = legalMoves((await saved(page)).game.st).find((m) => !m.promo)!;
    await move(page, sqName(legal.from), sqName(legal.to));
    await expect.poll(async () => (await saved(page)).game.hist.length).toBe(expected + 2);
    await page.getByRole("button", { name: "Off", exact: true }).click();
    await expect(page.getByRole("button", { name: "Review game", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Review game", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toContainText("analysing…", { timeout: 20000 });
    const reviewed = await saved(page);
    expect(Object.values(reviewed.game.evals).length).toBeGreaterThan(0);
    expect(
      Object.values(reviewed.game.evals).every((e) => e.review?.purpose === "neutral-review"),
    ).toBe(true);
    expect(reviewed.rating).toEqual(before.rating);
    expect(reviewed.game).toMatchObject({
      rated: false,
      ratingApplied: null,
      unratedReason: "beta",
    });
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.locator("header").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `/tmp/chess-prodigy-run2/beta-board-${color}-${info.project.name}.png`,
    });
    await context.setOffline(false);
  });

test("unavailable configuration exports a usable recovery copy without replacing saved progress", async ({
  page,
}) => {
  const s = beta();
  s.game.opponent.version = 99;
  await seed(page, s);
  await page.goto("/");
  await expect(page.getByText(/saved opponent version is unavailable/)).toBeVisible();
  await expect(page.getByRole("button", { name: "New game", exact: true })).toBeDisabled();
  const original = await page.evaluate(() => localStorage.getItem("chess-prodigy-state-v3"));
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download recovery save" }).click();
  const artifact = await download;
  const copy = JSON.parse(await readFile((await artifact.path())!, "utf8"));
  expect(copy.game).toEqual(s.game);
  expect(copy.rating).toEqual(s.rating);
  expect(await page.evaluate(() => localStorage.getItem("chess-prodigy-state-v3"))).toBe(original);
});

test("account Morphy resume and terminal archive retain identity without rating or guest writes", async ({
  page,
  context,
}, info) => {
  const base = "http://127.0.0.1:4318",
    s = beta();
  await context.setExtraHTTPHeaders({
    "CF-Connecting-IP": info.project.name === "mobile" ? "192.0.2.221" : "192.0.2.220",
  });
  const account = await context.request.post(`${base}/api/auth/sign-up/email`, {
    headers: { Origin: base },
    data: {
      name: "Synthetic Morphy Player",
      email: `morphy-${info.project.name}-${Date.now()}@example.com`,
      password: "correct horse battery staple",
    },
  });
  expect(account.ok()).toBe(true);
  const user = (await account.json()).user;
  const stored = await context.request.put(`${base}/api/records`, {
    headers: { Origin: base, "X-Chess-Account": user.id },
    data: { expectedVersion: 0, snapshot: s },
  });
  expect(stored.ok()).toBe(true);
  await page.goto(base);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Paul Morphy · Casual", { exact: true })).toBeVisible();
  await move(page, "e2", "e4");
  await expect(page.locator(".status")).toContainText("Your move");
  await page.getByRole("button", { name: "Resign", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Resign", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Unrated beta — this opponent predates rated Morphy",
  );
  await expect(page.getByText("Saved to account", { exact: true }).first()).toBeVisible();
  const get = () =>
    context.request
      .get(`${base}/api/records`, { headers: { "X-Chess-Account": user.id } })
      .then((r) => r.json());
  await expect.poll(async () => (await get()).games.length).toBe(1);
  const records = await get();
  expect(records.games[0]).toMatchObject({
    opponent: s.game.opponent,
    rated: false,
    unratedReason: "beta",
    assisted: false,
  });
  expect(records.snapshot.rating).toEqual(s.rating);
  expect(await page.evaluate(() => localStorage.getItem("chess-prodigy-state-v3"))).toBeNull();
  await page.reload();
  await expect(page.getByRole("dialog")).toContainText("Unrated beta");
  expect((await get()).games).toHaveLength(1);
});
