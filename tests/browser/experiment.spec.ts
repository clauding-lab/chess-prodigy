import { expect, test, type Page } from "@playwright/test";
import { savedSession } from "./saved-session";
import { experimentalRosterConfig } from "../../src/engine/opponents";
import { freshSession, reduceSession } from "../../src/game/state";
import { applyMove, legalMoves, sanFor, sqName } from "../../src/engine/board";
import { encodeCompactSession } from "../../src/storage/compact";
import { SAVE_KEY } from "../../src/storage/store";
import talBook from "../../src/book/tal-book.json" with { type: "json" };
import fischerBook from "../../src/book/fischer-book.json" with { type: "json" };
import { rosterBookKey } from "../../src/engine/roster/book";
const enabled =
  process.env.VITE_ENGINE_EXPERIMENT === "true" && process.env.VITE_PERSONALITY_BETA === "true";
async function setup(page: Page, id: "tal" | "fischer", color = "White", level = "Club") {
  const name = id === "tal" ? "Mikhail Tal" : "Bobby Fischer";
  await page.getByRole("button", { name: `Play ${name}`, exact: true }).click();
  const modal = page.getByRole("dialog", { name: "New game", exact: true });
  await expect(modal).toContainText("Experimental opponent — unrated");
  await modal.getByRole("button", { name: color, exact: true }).click();
  await modal.getByRole("button", { name: level, exact: true }).click();
  await modal.getByRole("button", { name: "No clock", exact: true }).click();
  await modal.getByRole("button", { name: "Start", exact: true }).click();
}
for (const id of ["tal", "fischer"] as const)
  for (const color of ["White", "Black"])
    for (const level of ["Casual", "Club", "Strong"])
      test(`experimental ${id} ${color} ${level} saves, reloads and rematches unrated`, async ({
        page,
      }) => {
        test.skip(!enabled, "New experimental setup is intentionally default-off.");
        await page.goto("/");
        await setup(page, id, color, level);
        if (color === "White") {
          await page.getByRole("button", { name: "e2, white pawn", exact: true }).click();
          await page.getByRole("button", { name: "e4, empty", exact: true }).click();
        }
        await expect
          .poll(async () => (await savedSession(page)).game.hist.length)
          .toBe(color === "White" ? 2 : 1);
        const active = await savedSession(page);
        expect(active.game.opponent).toMatchObject({ id, version: 2, engine: `${id}-coherent-v1` });
        expect(active.game.rated).toBe(false);
        await page.reload();
        await expect(page.getByRole("button", { name: "Resume game", exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Resume game", exact: true }).click();
        expect((await savedSession(page)).game.opponent).toEqual(active.game.opponent);
        await page.getByRole("button", { name: "Resign", exact: true }).click();
        await page
          .getByRole("dialog", { name: "Resign this game?" })
          .getByRole("button", { name: "Resign", exact: true })
          .click();
        const ended = await savedSession(page);
        expect(ended.rating).toEqual(active.rating);
        expect(ended.game.ratingApplied).toBeNull();
        await page.getByRole("button", { name: "Rematch", exact: true }).click();
        await page
          .getByRole("dialog", { name: "New game", exact: true })
          .getByRole("button", { name: "Start", exact: true })
          .click();
        const rematch = await savedSession(page);
        expect(rematch.game.rated).toBe(false);
        expect(rematch.game.ratingApplied).toBeNull();
        expect(rematch.game.opponent).toMatchObject({
          id,
          version: 2,
          engine: `${id}-coherent-v1`,
        });
      });
function offbook(id: "tal" | "fischer") {
  let s = reduceSession(freshSession(0, "seed"), {
    type: "new",
    id: `saved-experiment-${id}`,
    now: 0,
    setup: {
      playerColor: "w",
      level: "club",
      time: "none",
      opponent: experimentalRosterConfig(id, 11),
    },
  });
  for (const san of ["h3", "a6", "a3", "h6", "g3", "a5", "g4"]) {
    const m = legalMoves(s.game.st).find(
      (m) => sanFor(s.game.st, m, applyMove(s.game.st, m)) === san,
    )!;
    s = reduceSession(s, { type: "move", move: m, book: false, now: 1 });
  }
  const book = id === "tal" ? talBook : fischerBook;
  expect(Object.hasOwn(book, rosterBookKey(s.game.st))).toBe(false);
  s.preferences.coach = false;
  return encodeCompactSession(s);
}
for (const id of ["tal", "fischer"] as const)
  test(`saved experimental ${id} runs offbook and offline even when selection is disabled`, async ({
    page,
    context,
  }) => {
    await page.addInitScript(
      ({ key, value }) => {
        if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(value));
      },
      { key: SAVE_KEY, value: offbook(id) },
    );
    await page.goto("/");
    await page.getByRole("button", { name: "Resume game", exact: true }).click();
    await expect.poll(async () => (await savedSession(page)).game.hist.length).toBe(8);
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      if (!registration.active) throw Error("No active offline worker");
    });
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    await page.reload();
    await page.getByRole("button", { name: "Resume game", exact: true }).click();
    const s = await savedSession(page),
      move = legalMoves(s.game.st).find((m) => !m.promo)!;
    await page.getByRole("button", { name: new RegExp(`^${sqName(move.from)},`) }).click();
    await page.getByRole("button", { name: new RegExp(`^${sqName(move.to)},`) }).click();
    await expect.poll(async () => (await savedSession(page)).game.hist.length).toBe(10);
    expect((await savedSession(page)).game.rated).toBe(false);
    await context.setOffline(false);
  });
test("stopped experimental worker preserves the board and offers a working retry", async ({
  page,
}) => {
  test.skip(!enabled, "Experimental setup flag is required.");
  await page.addInitScript(() => {
    const post = Worker.prototype.postMessage;
    Reflect.set(window, "dropExperiment", true);
    Reflect.set(window, "experimentAttempts", 0);
    Worker.prototype.postMessage = function (request, ...rest) {
      if (request.opponent?.version === 2 && request.opponent?.engine?.endsWith("-coherent-v1")) {
        Reflect.set(window, "experimentAttempts", Reflect.get(window, "experimentAttempts") + 1);
        if (Reflect.get(window, "dropExperiment")) {
          this.terminate();
          return;
        }
      }
      return post.call(this, request, ...rest);
    };
  });
  await page.goto("/");
  await setup(page, "tal");
  await page.getByRole("button", { name: "e2, white pawn", exact: true }).click();
  await page.getByRole("button", { name: "e4, empty", exact: true }).click();
  await expect(page.getByRole("button", { name: "Try the engine again", exact: true })).toBeVisible(
    { timeout: 10000 },
  );
  expect(await page.evaluate(() => Reflect.get(window, "experimentAttempts"))).toBe(2);
  expect((await savedSession(page)).game.hist).toHaveLength(1);
  await page.evaluate(() => Reflect.set(window, "dropExperiment", false));
  await page.getByRole("button", { name: "Try the engine again", exact: true }).click();
  await expect.poll(async () => (await savedSession(page)).game.hist.length).toBe(2);
  expect((await savedSession(page)).game.ratingApplied).toBeNull();
});
