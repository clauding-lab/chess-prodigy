import { enterPlay } from "./enter-play";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createHash } from "node:crypto";
import { CLASSIC, morphyConfig } from "../../src/engine/opponents";
import { legalMoves, sqName } from "../../src/engine/board";
import { freshSession, reduceSession } from "../../src/game/state";
import { archiveGame } from "../../src/game/archive";
import { GUEST_HISTORY_KEY } from "../../src/storage/history";
import type { GameRecord } from "../../src/account/types";
import type { Session, Setup } from "../../src/game/types";

const STATE_KEY = "chess-prodigy-state-v4";
const accountBase = "http://127.0.0.1:4318";
const saved = (page: Page): Promise<Session> =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STATE_KEY);

function fixture(id: string, setup: Partial<Setup> = {}, completed = false): Session {
  const now = Date.now();
  let session = reduceSession(freshSession(now, `${id}-initial`), {
    type: "new",
    id,
    now,
    setup: { playerColor: "w", level: "casual", time: "none", opponent: CLASSIC, ...setup },
  });
  session.preferences.coach = false;
  session.preferences.sound = false;
  for (const [from, to] of [
    ["e2", "e4"],
    ["e7", "e5"],
  ]) {
    const move = legalMoves(session.game.st).find(
      (candidate) => sqName(candidate.from) === from && sqName(candidate.to) === to,
    )!;
    session = reduceSession(session, { type: "move", move, book: true, now });
  }
  if (completed) session = reduceSession(session, { type: "resign", now });
  return session;
}

async function seed(
  page: Page,
  session: Session,
  games: GameRecord[] = [],
  origin = "http://127.0.0.1:4173",
) {
  const setupUrl = `${origin}/api/test-seed`;
  await page.route(
    setupUrl,
    (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>One-time record fixture</title>",
      }),
    { times: 1 },
  );
  await page.goto(setupUrl);
  await enterPlay(page);
  // Write once before the app mounts. No reload hook may repair missing storage.
  await page.evaluate(
    ({ session, games, stateKey, historyKey }) => {
      localStorage.setItem(stateKey, JSON.stringify(session));
      localStorage.setItem(historyKey, JSON.stringify({ version: 1, games }));
    },
    { session, games, stateKey: STATE_KEY, historyKey: GUEST_HISTORY_KEY },
  );
}

async function openRecords(page: Page) {
  await page.getByRole("button", { name: "Games", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Recorded games" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("guest completion remains replayable after starting a new game without changing its rating or board", async ({
  page,
}) => {
  await seed(page, fixture("synthetic-guest-live"));
  await page.goto("/");
  await enterPlay(page);
  await page.getByRole("button", { name: "g1, white knight", exact: true }).click();
  await page.getByRole("button", { name: "f3, empty", exact: true }).click();
  await expect.poll(async () => (await saved(page)).game.hist.length).toBe(4);
  await page.getByRole("button", { name: "Resign", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Resign this game?" })
    .getByRole("button", { name: "Resign", exact: true })
    .click();
  const result = page.getByRole("dialog", { name: "Resignation" });
  await expect(result.getByRole("region", { name: "Recorded rivalry" })).toContainText(
    "1 recorded game",
  );
  const completed = await saved(page);
  await result.getByRole("button", { name: "New game", exact: true }).click();
  await page
    .getByRole("dialog", { name: "New game" })
    .getByRole("button", { name: "Start", exact: true })
    .click();
  const beforeReplay = await saved(page);
  expect(beforeReplay.game.id).not.toBe(completed.game.id);
  expect(beforeReplay.rating).toEqual(completed.rating);
  const records = await openRecords(page);
  await expect(records).toContainText("Guest records — this browser only");
  await expect(records.getByRole("listitem")).toHaveCount(1);
  await records.getByRole("button", { name: "Replay recorded game 1" }).click();
  const replay = records.getByRole("region", { name: "Recorded game replay" });
  await expect(replay).toContainText("Starting position");
  await replay.getByRole("button", { name: "Next move", exact: true }).click();
  await expect(replay).toContainText("1. e4");
  await expect(replay.getByRole("button", { name: "e4, white pawn", exact: true })).toBeDisabled();
  await replay.getByRole("button", { name: "Previous move", exact: true }).click();
  await expect(replay).toContainText("Starting position");
  await replay.getByRole("button", { name: "Close replay" }).click();
  await expect(records.getByRole("button", { name: "Replay recorded game 1" })).toBeFocused();
  await records.getByRole("button", { name: "Close games" }).click();
  expect((await saved(page)).game).toEqual(beforeReplay.game);
  expect((await saved(page)).rating).toEqual(completed.rating);
});

for (const color of ["w", "b"] as const)
  test(`Classic result rematch retains ${color} settings and begins a fresh game`, async ({
    page,
  }) => {
    const previous = fixture(
      `synthetic-classic-${color}`,
      { playerColor: color, time: "15+10" },
      true,
    );
    await seed(page, previous);
    await page.goto("/");
    await enterPlay(page);
    await page
      .getByRole("dialog", { name: "Resignation" })
      .getByRole("button", { name: "Rematch", exact: true })
      .click();
    const setup = page.getByRole("dialog", { name: "New game" });
    for (const name of ["Classic", color === "w" ? "White" : "Black", "15 | 10"])
      await expect(setup.getByRole("button", { name, exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    await expect(setup.getByRole("button", { name: /^Casual/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect((await saved(page)).game.id).toBe(previous.game.id);
    await setup.getByRole("button", { name: "Start", exact: true }).click();
    const next = await saved(page);
    expect(next.game.id).not.toBe(previous.game.id);
    expect(next.game.setup).toEqual(previous.game.setup);
    expect(next.game.opponent).toEqual(CLASSIC);
    expect(next.game.over).toBeNull();
    expect(next.game.ratingApplied).toBeNull();
    expect(next.rating).toEqual(previous.rating);
  });

test("archived Morphy replay remains available and rematch obeys the beta build flag", async ({
  page,
}) => {
  const previous = fixture(
    "synthetic-morphy-record",
    { opponent: morphyConfig(4), playerColor: "b", time: "10+0" },
    true,
  );
  const active = fixture("synthetic-active-morphy", { opponent: morphyConfig(9) });
  await seed(page, active, [archiveGame(previous)!]);
  await page.goto("/");
  await enterPlay(page);
  const records = await openRecords(page);
  await records
    .getByRole("combobox", { name: "Opponent and difficulty" })
    .selectOption({ label: "Paul Morphy · v1 · Casual" });
  await expect(records.getByRole("region", { name: "Recorded rivalry" })).toContainText(
    "1 recorded game",
  );
  await records.getByRole("button", { name: "Replay recorded game 1" }).click();
  await records.getByRole("slider", { name: "Replay position" }).press("End");
  await expect(records.getByRole("region", { name: "Recorded game replay" })).toContainText(
    "2 / 2 half-moves",
  );
  expect((await saved(page)).game).toEqual(active.game);
  const rematch = records.getByRole("button", { name: "Rematch recorded game 1" });
  if (process.env.VITE_PERSONALITY_BETA !== "true") {
    await expect(rematch).toBeDisabled();
    await expect(records).toContainText("Paul Morphy beta is disabled in this build");
    return;
  }
  await rematch.click();
  await page.getByRole("button", { name: "Forfeit and continue", exact: true }).click();
  const setup = page.getByRole("dialog", { name: "New game" });
  for (const name of ["Paul Morphy", "Black", "Casual", "10 min"])
    await expect(setup.getByRole("button", { name, exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  await setup.getByRole("button", { name: "Start", exact: true }).click();
  const next = await saved(page);
  expect(next.game.id).not.toBe(previous.game.id);
  expect(next.game.setup).toEqual(previous.game.setup);
  expect(next.game.opponent).toMatchObject({ ...previous.game.opponent, seed: expect.any(Number) });
  expect(next.game.opponent.seed).not.toBe(previous.game.opponent.seed);
  expect(next.game.rated).toBe(false);
  expect(next.rating).toEqual(active.rating);
});

test("recorded games and keyboard replay fit a 320px screen in dark and wooden themes", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const archived = archiveGame(fixture("synthetic-narrow-record", {}, true))!;
  await seed(page, fixture("synthetic-narrow-active"), [archived]);
  await page.goto("/");
  await enterPlay(page);
  for (const theme of ["dark", "wood"] as const) {
    if (theme === "wood")
      await page.getByRole("button", { name: "Wooden board", exact: true }).click();
    const trigger = page.getByRole("button", { name: "Games", exact: true });
    await trigger.focus();
    await trigger.press("Enter");
    const records = page.getByRole("dialog", { name: "Recorded games" });
    const replayButton = records.getByRole("button", { name: "Replay recorded game 1" });
    await replayButton.focus();
    await replayButton.press("Enter");
    const replay = records.getByRole("region", { name: "Recorded game replay" });
    await expect(replay).toBeFocused();
    const slider = replay.getByRole("slider", { name: "Replay position" });
    await slider.focus();
    await slider.press("End");
    await expect(replay).toContainText("2 / 2 half-moves");
    await slider.press("ArrowLeft");
    await expect(replay).toContainText("1. e4");
    await slider.press("Home");
    await expect(replay).toContainText("Starting position");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(await records.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `/tmp/chess-prodigy-run3/records-${theme}-${info.project.name}.png`,
    });
    await replay.getByRole("button", { name: "Close replay" }).click();
    await expect(replayButton).toBeFocused();
    await replayButton.press("Escape");
    await expect(records).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
});

test("Chrome offline reload preserves the archive and replays without touching the active game", async ({
  page,
  context,
}) => {
  const active = fixture("synthetic-offline-active");
  await seed(page, active, [archiveGame(fixture("synthetic-offline-record", {}, true))!]);
  await page.goto("/");
  await enterPlay(page);
  const records = await openRecords(page);
  await expect(records.getByRole("listitem")).toHaveCount(1);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  try {
    await page.reload();
    await enterPlay(page);
    const offlineRecords = await openRecords(page);
    await offlineRecords.getByRole("button", { name: "Replay recorded game 1" }).click();
    await offlineRecords.getByRole("slider", { name: "Replay position" }).press("End");
    await expect(
      offlineRecords.getByRole("region", { name: "Recorded game replay" }),
    ).toContainText("1... e5");
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    expect((await saved(page)).game).toEqual(active.game);
    expect((await saved(page)).rating).toEqual(active.rating);
  } finally {
    await context.setOffline(false);
  }
});

async function register(context: BrowserContext, suffix: string) {
  const response = await context.request.post(`${accountBase}/api/auth/sign-up/email`, {
    headers: { Origin: accountBase },
    data: {
      name: `Synthetic ${suffix}`,
      email: `${suffix}@example.com`,
      password: "correct horse battery staple",
    },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()).user as { id: string; name: string };
}

test("private account records are visible only to that account and never import guest history", async ({
  page,
  context,
}, info) => {
  const bytes = createHash("sha256")
    .update(info.project.name + info.testId)
    .digest();
  await context.setExtraHTTPHeaders({ "CF-Connecting-IP": `192.0.${bytes[0]}.${bytes[1]}` });
  const suffix = `records-${info.project.name}-${Date.now()}`;
  const guest = fixture("synthetic-isolated-guest");
  await seed(page, guest, [archiveGame(fixture("synthetic-guest-only", {}, true))!], accountBase);
  const owner = await register(context, suffix);
  const terminal = fixture("synthetic-account-only", { opponent: morphyConfig(7) }, true);
  for (const [expectedVersion, snapshot] of [
    [0, terminal],
    [1, fixture("synthetic-account-active")],
  ] as const) {
    const response = await context.request.put(`${accountBase}/api/records`, {
      headers: { Origin: accountBase, "X-Chess-Account": owner.id },
      data: { expectedVersion, snapshot },
    });
    expect(response.ok()).toBe(true);
  }
  await page.goto(accountBase);
  await enterPlay(page);
  let records = await openRecords(page);
  await expect(records).toContainText("Private records — this account only");
  await expect(records.getByRole("listitem")).toHaveCount(0);
  await records
    .getByRole("combobox", { name: "Opponent and difficulty" })
    .selectOption({ label: "Paul Morphy · v1 · Casual" });
  await expect(records.getByRole("listitem")).toHaveCount(1);
  await records.getByRole("button", { name: "Replay recorded game 1" }).click();
  await expect(records.getByRole("region", { name: "Recorded game replay" })).toBeVisible();
  await records.getByRole("button", { name: "Close games" }).click();
  await page.getByRole("button", { name: owner.name, exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  records = await openRecords(page);
  await expect(records).toContainText("Guest records — this browser only");
  await expect(records.getByRole("listitem")).toHaveCount(1);
  await expect(
    records.getByRole("combobox").getByRole("option", { name: /Paul Morphy/ }),
  ).toHaveCount(0);
  expect((await saved(page)).game.id).toBe(guest.game.id);
  await records.getByRole("button", { name: "Close games" }).click();
  const other = await register(context, `${suffix}-other`);
  const response = await context.request.put(`${accountBase}/api/records`, {
    headers: { Origin: accountBase, "X-Chess-Account": other.id },
    data: { expectedVersion: 0, snapshot: fixture("synthetic-other-account") },
  });
  expect(response.ok()).toBe(true);
  await page.reload();
  await enterPlay(page);
  records = await openRecords(page);
  await expect(records).toContainText("Private records — this account only");
  await expect(records.getByRole("listitem")).toHaveCount(0);
  await expect(
    records.getByRole("combobox").getByRole("option", { name: /Paul Morphy/ }),
  ).toHaveCount(0);
  const unauthorized = await context.request.get(`${accountBase}/api/records`, {
    headers: { "X-Chess-Account": owner.id },
  });
  expect(unauthorized.status()).toBe(401);
  expect((await saved(page)).game.id).toBe(guest.game.id);
});
