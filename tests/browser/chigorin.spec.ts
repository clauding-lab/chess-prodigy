import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { chigorinConfig } from "../../src/engine/opponents";
import { CHIGORIN_RATINGS } from "../../src/rating/opponents";
import { LEVEL_LABEL } from "../../src/rating/fide";
import { SAVE_KEY } from "../../src/storage/store";
import { GUEST_HISTORY_KEY } from "../../src/storage/history";
import { applyMove, legalMoves, sanFor, sqName } from "../../src/engine/board";
import { freshSession, reduceSession } from "../../src/game/state";
import type { Session } from "../../src/game/types";
import { enterPlay } from "./enter-play";

const saved = (page: Page): Promise<Session> =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
async function move(page: Page, from: string, to: string) {
  await page.getByRole("button", { name: new RegExp(`^${from},`) }).click();
  await page.getByRole("button", { name: new RegExp(`^${to},`) }).click();
}

test("Chigorin follows the build flag and waits for accepted measurements", async ({ page }) => {
  await page.goto("/");
  const play = page.getByRole("button", { name: "Play Mikhail Chigorin", exact: true });
  if (process.env.VITE_PERSONALITY_BETA !== "true") {
    await expect(play).toHaveCount(0);
    await enterPlay(page);
    await expect(page.getByRole("button", { name: "Mikhail Chigorin", exact: true })).toHaveCount(
      0,
    );
  } else if (CHIGORIN_RATINGS === null) {
    await expect(play).toBeDisabled();
    await expect(page.getByText("Strength measurement in progress.")).toBeVisible();
    await enterPlay(page);
    await expect(
      page.getByRole("button", { name: "Mikhail Chigorin", exact: true }),
    ).toBeDisabled();
  } else await expect(play).toBeEnabled();
});

for (const level of ["casual", "club", "strong"] as const)
  for (const color of ["White", "Black"] as const)
    test(`Chigorin ${level} as ${color}: saved identity, offline reply, forfeit, replay and rematch`, async ({
      page,
      context,
    }, info) => {
      test.skip(
        process.env.VITE_PERSONALITY_BETA !== "true" || CHIGORIN_RATINGS === null,
        "Normal Chigorin setup requires an enabled build and accepted measurements.",
      );
      await page.goto("/");
      await expect(page.locator(".app")).toHaveAttribute("data-theme", "dark");
      await page.getByRole("button", { name: "Play Mikhail Chigorin", exact: true }).click();
      const setup = page.getByRole("dialog", { name: "New game" });
      await expect(setup).toContainText("active knights, central counterplay");
      for (const difficulty of ["casual", "club", "strong"] as const)
        await expect(
          setup.getByRole("button", {
            name: `${LEVEL_LABEL[difficulty]} ${CHIGORIN_RATINGS![difficulty]}`,
            exact: true,
          }),
        ).toBeVisible();
      await setup
        .getByRole("button", {
          name: `${LEVEL_LABEL[level]} ${CHIGORIN_RATINGS![level]}`,
          exact: true,
        })
        .click();
      await setup.getByRole("button", { name: color, exact: true }).click();
      await setup.getByRole("button", { name: "No clock", exact: true }).click();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({
        path: info.outputPath(`chigorin-setup-${level}-${color}.png`),
        fullPage: true,
      });
      await setup.getByRole("button", { name: "Start", exact: true }).click();
      if (color === "White") await move(page, "e2", "e4");
      await expect
        .poll(async () => (await saved(page)).game.hist.length)
        .toBe(color === "White" ? 2 : 1);
      const before = await saved(page);
      expect(before.game.opponent).toEqual(chigorinConfig(before.game.opponent.seed!));
      expect(before.game.rated).toBe(true);
      await page.getByRole("button", { name: "Home", exact: true }).click();
      await expect(page.getByRole("button", { name: "Resume game", exact: true })).toBeVisible();
      await page.evaluate(async () => {
        await navigator.serviceWorker.ready;
      });
      await context.setOffline(true);
      await page.reload();
      await enterPlay(page);
      expect((await saved(page)).game.opponent).toEqual(before.game.opponent);
      const legal = legalMoves(before.game.st).find((candidate) => !candidate.promo)!;
      await move(page, sqName(legal.from), sqName(legal.to));
      await expect
        .poll(async () => (await saved(page)).game.hist.length)
        .toBe(before.game.hist.length + 2);
      await page.getByRole("button", { name: "Flip", exact: true }).click();
      await expect(
        page.getByText(`Mikhail Chigorin · ${LEVEL_LABEL[level]}`, { exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Home", exact: true }).click();
      await page.getByRole("button", { name: "Play Classic", exact: true }).click();
      const gate = page.getByRole("dialog", { name: "Finish your current game?" });
      await expect(gate).toContainText("Mikhail Chigorin");
      await expect(gate).toContainText("rated loss");
      await gate.getByRole("button", { name: "Forfeit and continue", exact: true }).click();
      await setup.getByRole("button", { name: "Cancel", exact: true }).click();
      const ended = await saved(page);
      expect(ended.rating.games).toBe(1);
      expect(ended.rating.history.at(-1)).toMatchObject({
        oppRating: CHIGORIN_RATINGS![level],
        score: 0,
      });
      await page.getByRole("button", { name: "Games", exact: true }).click();
      const records = page.getByRole("dialog", { name: "Recorded games" });
      await expect(records.getByRole("region", { name: "Recorded rivalry" })).toContainText(
        "1 recorded game",
      );
      await records.getByRole("button", { name: "Replay recorded game 1", exact: true }).click();
      await records.getByRole("button", { name: "Last position", exact: true }).click();
      await expect(records.getByRole("region", { name: "Recorded game replay" })).toContainText(
        `${ended.game.hist.length} / ${ended.game.hist.length} half-moves`,
      );
      await records.getByRole("button", { name: "Rematch recorded game 1", exact: true }).click();
      await expect(
        setup.getByRole("button", { name: "Mikhail Chigorin", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(
        setup.getByRole("button", {
          name: `${LEVEL_LABEL[level]} ${CHIGORIN_RATINGS![level]}`,
          exact: true,
        }),
      ).toHaveAttribute("aria-pressed", "true");
      await setup.getByRole("button", { name: "Start", exact: true }).click();
      const rematch = await saved(page);
      expect(rematch.game.id).not.toBe(ended.game.id);
      expect(rematch.game.opponent).toMatchObject({
        ...chigorinConfig(0),
        seed: expect.any(Number),
      });
      expect(rematch.rating).toEqual(ended.rating);
      await context.setOffline(false);
      await page.screenshot({
        path: info.outputPath(`chigorin-rematch-${level}-${color}.png`),
        fullPage: true,
      });
    });

test("account Chigorin keeps its measured receipt, private archive and permanent client protection", async ({
  page,
  context,
}, info) => {
  test.skip(
    process.env.VITE_PERSONALITY_BETA !== "true" || CHIGORIN_RATINGS === null,
    "Requires accepted Chigorin measurement.",
  );
  const origin = "http://127.0.0.1:4318";
  const suffix = `${info.project.name}-${Date.now()}`;
  const bytes = createHash("sha256").update(suffix).digest();
  await context.setExtraHTTPHeaders({ "CF-Connecting-IP": `192.0.${bytes[0]}.${bytes[1]}` });
  const registration = await page.request.post(`${origin}/api/auth/sign-up/email`, {
    headers: { Origin: origin },
    data: {
      name: `Chigorin ${suffix}`,
      email: `chigorin-${suffix}@example.com`,
      password: "correct horse battery staple",
    },
  });
  expect(registration.status()).toBe(200);
  const { user } = await registration.json();
  let session = reduceSession(freshSession(Date.now(), "initial"), {
    type: "new",
    id: `chigorin-${suffix}`,
    now: Date.now(),
    setup: { playerColor: "w", level: "club", time: "none", opponent: chigorinConfig(91) },
  });
  for (const san of ["e4", "e5"]) {
    const candidate = legalMoves(session.game.st).find(
      (m) => sanFor(session.game.st, m, applyMove(session.game.st, m)) === san,
    )!;
    session = reduceSession(session, {
      type: "move",
      move: candidate,
      now: Date.now(),
      book: false,
    });
  }
  const headers = { Origin: origin, "X-Chess-Account": user.id, "X-Chess-Rating-Policy": "4" };
  expect(
    (
      await page.request.put(`${origin}/api/records`, {
        headers,
        data: { expectedVersion: 0, snapshot: session },
      })
    ).status(),
  ).toBe(200);
  await page.goto(origin);
  await enterPlay(page);
  await expect(page.getByText("Mikhail Chigorin · Club", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Resign", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Resign this game?" })
    .getByRole("button", { name: "Resign", exact: true })
    .click();
  const read = async () => {
    const response = await page.request.get(`${origin}/api/records`, { headers });
    expect(response.status()).toBe(200);
    return response.json();
  };
  await expect.poll(async () => (await read()).snapshot.rating.games).toBe(1);
  const before = await read();
  expect(before.snapshot.rating.history.at(-1)).toMatchObject({
    opp: "Mikhail Chigorin · Club",
    oppRating: CHIGORIN_RATINGS!.club,
    score: 0,
  });
  expect(before.games).toHaveLength(1);
  expect(before.games[0].opponent).toEqual(session.game.opponent);
  for (const oldPolicy of [undefined, "1", "2", "3"]) {
    const rejected = await page.request.put(`${origin}/api/records`, {
      headers: {
        Origin: origin,
        "X-Chess-Account": user.id,
        ...(oldPolicy ? { "X-Chess-Rating-Policy": oldPolicy } : {}),
      },
      data: { expectedVersion: before.version, snapshot: freshSession(Date.now(), "older-client") },
    });
    expect(rejected.status()).toBe(426);
  }
  await page.reload();
  await enterPlay(page);
  expect((await read()).snapshot.rating).toEqual(before.snapshot.rating);
  await page.getByRole("button", { name: "View board", exact: true }).click();
  await page.getByRole("button", { name: "Games", exact: true }).click();
  await page.getByRole("button", { name: "Replay recorded game 1", exact: true }).click();
  await expect(page.getByRole("region", { name: "Recorded game replay" })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY)).toBeNull();
  expect(await page.evaluate((key) => localStorage.getItem(key), GUEST_HISTORY_KEY)).toBeNull();
});

for (const color of ["w", "b"] as const)
  test(`saved Chigorin ${color} resumes with exact identity and neutral review offline`, async ({
    page,
    context,
  }, info) => {
    const session = reduceSession(freshSession(Date.now(), "initial"), {
      type: "new",
      id: `saved-chigorin-${color}`,
      now: Date.now(),
      setup: { playerColor: color, level: "casual", time: "none", opponent: chigorinConfig(271) },
    });
    session.preferences.coach = false;
    await page.addInitScript(
      ({ key, session }) => {
        if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(session));
      },
      { key: SAVE_KEY, session },
    );
    await page.goto("/");
    await enterPlay(page);
    if (color === "w") await move(page, "e2", "e4");
    await expect.poll(async () => (await saved(page)).game.hist.length).toBe(color === "w" ? 2 : 1);
    const before = await saved(page);
    expect(before.game.opponent).toEqual(session.game.opponent);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole("button", { name: "Resume game", exact: true })).toBeVisible();
    await enterPlay(page);
    expect((await saved(page)).game.opponent).toEqual(before.game.opponent);
    const candidate = legalMoves(before.game.st).find((m) => !m.promo)!;
    await move(page, sqName(candidate.from), sqName(candidate.to));
    await expect
      .poll(async () => (await saved(page)).game.hist.length)
      .toBe(before.game.hist.length + 2);
    await page.getByRole("button", { name: "Flip", exact: true }).click();
    await expect(page.getByText("Mikhail Chigorin · Casual", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Off", exact: true }).click();
    await expect(page.getByRole("button", { name: "Review game", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Review game", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toContainText("analysing…", { timeout: 20000 });
    const reviewed = await saved(page);
    expect(Object.values(reviewed.game.evals).length).toBeGreaterThan(0);
    expect(
      Object.values(reviewed.game.evals).every(
        (evaluation) => evaluation.review?.purpose === "neutral-review",
      ),
    ).toBe(true);
    expect(reviewed.rating).toEqual(before.rating);
    expect(reviewed.game.opponent).toEqual(before.game.opponent);
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.screenshot({
      path: info.outputPath(`chigorin-offline-${color}.png`),
      fullPage: true,
    });
    await context.setOffline(false);
  });
