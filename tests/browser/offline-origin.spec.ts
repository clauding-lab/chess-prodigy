import { enterPlay } from "./enter-play";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { freshSession, reduceSession } from "../../src/game/state";
import {
  CLASSIC,
  morphyConfig,
  ratedMorphyConfig,
  historicalMorphyConfig,
  plannedMorphyConfig,
} from "../../src/engine/opponents";
import { applyMove, legalMoves, sanFor, sqName } from "../../src/engine/board";
import type { Session } from "../../src/game/types";

async function startOrigin() {
  const root = resolve("dist");
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
      if (pathname === "/api/seed-fixture") {
        response
          .writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store" })
          .end("<!doctype html><title>One-time test setup</title>");
        return;
      }
      const file = resolve(root, pathname === "/" ? "index.html" : "." + pathname);
      if (!file.startsWith(root + "/")) {
        response.writeHead(403).end();
        return;
      }
      const body = await readFile(file);
      const types: Record<string, string> = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".png": "image/png",
        ".webmanifest": "application/manifest+json",
      };
      response
        .writeHead(200, {
          "Content-Type": types[extname(file)] ?? "application/octet-stream",
          "Cache-Control": "no-store",
        })
        .end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing disposable origin");
  return {
    url: `http://127.0.0.1:${address.port}`,
    async stop() {
      if (!server.listening) return;
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

const saved = (page: Page): Promise<Session> =>
  page.evaluate(() => JSON.parse(localStorage.getItem("chess-prodigy-state-v5")!));

function seedSession(
  profile: "Classic" | "Morphy" | "Measured Morphy" | "Historical Morphy" | "Planned Morphy",
  color: "w" | "b",
) {
  const now = Date.now();
  let session = reduceSession(freshSession(now, "initial"), {
    type: "new",
    now,
    id: `origin-outage-${profile}-${color}`,
    setup: {
      playerColor: color,
      level: "casual",
      time: "none",
      opponent:
        profile === "Classic"
          ? CLASSIC
          : profile === "Morphy"
            ? morphyConfig(4)
            : profile === "Measured Morphy"
              ? ratedMorphyConfig(4)
              : profile === "Historical Morphy"
                ? historicalMorphyConfig(4)
                : plannedMorphyConfig(4),
    },
  });
  // Legally seed an out-of-book, already-started game on the human's turn.
  for (const san of color === "w" ? ["a3", "a6"] : ["a3"]) {
    const move = legalMoves(session.game.st).find(
      (m) => sanFor(session.game.st, m, applyMove(session.game.st, m)) === san,
    );
    if (!move) throw new Error(`Invalid seed move: ${san}`);
    session = reduceSession(session, { type: "move", move, book: false, now });
  }
  session.preferences.coach = false;
  return session;
}

for (const profile of [
  "Classic",
  "Morphy",
  "Measured Morphy",
  "Historical Morphy",
  "Planned Morphy",
] as const)
  for (const color of ["w", "b"] as const)
    test(`${profile} ${color} reloads, reopens, plays and reviews with its origin stopped`, async ({
      page,
      context,
    }, info) => {
      const origin = await startOrigin();
      try {
        const seed = seedSession(profile, color);
        // Seed once on an empty same-origin document before the app mounts.
        // Reload/reopen must preserve storage themselves; no init script can restore it.
        await page.goto(`${origin.url}/api/seed-fixture`);
        await enterPlay(page);
        await page.evaluate((value) => {
          localStorage.setItem("chess-prodigy-state-v5", JSON.stringify(value));
        }, seed);
        await page.goto(origin.url);
        await enterPlay(page);
        await expect(page.locator(".status")).toContainText("Your move");
        await page.evaluate(async () => {
          await navigator.serviceWorker.ready;
        });
        await page.reload();
        await enterPlay(page);
        await expect
          .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
          .toBe(true);
        const before = await saved(page);
        expect(before.game.opponent).toEqual(seed.game.opponent);
        expect(before.game.hist.map((entry) => entry.san)).toEqual(
          seed.game.hist.map((entry) => entry.san),
        );

        await origin.stop();
        // This is an origin outage, not device airplane mode: navigator.onLine stays unchanged.
        // An API URL bypasses the navigation fallback and must be unreachable.
        expect(
          await page.evaluate(async () => {
            try {
              await fetch("/api/uncached-control", { cache: "no-store" });
              return false;
            } catch {
              return true;
            }
          }),
        ).toBe(true);
        await page.reload();
        await enterPlay(page);
        await expect(page.locator(".status")).toContainText("Your move");
        const reopened = await context.newPage();
        await page.close();
        await reopened.goto(origin.url);
        await enterPlay(reopened);
        await expect(reopened.locator(".status")).toContainText("Your move");
        const resumed = await saved(reopened);
        expect(resumed.game.id).toBe(before.game.id);
        expect(resumed.game.opponent).toEqual(before.game.opponent);
        expect(resumed.game.hist).toEqual(before.game.hist);
        expect(resumed.rating).toEqual(before.rating);
        expect(resumed.preferences).toEqual(before.preferences);

        const move = legalMoves(resumed.game.st).find((m) => !m.promo);
        if (!move) throw new Error("No legal continuation in seed position");
        await reopened.getByRole("button", { name: new RegExp(`^${sqName(move.from)},`) }).click();
        await reopened.getByRole("button", { name: new RegExp(`^${sqName(move.to)},`) }).click();
        await expect
          .poll(async () => (await saved(reopened)).game.hist.length)
          .toBe(before.game.hist.length + 2);
        await expect(reopened.locator(".status")).toContainText("Your move");
        await reopened.getByRole("button", { name: "Off", exact: true }).click();
        await reopened.getByRole("button", { name: "Review game", exact: true }).click();
        await expect(reopened.getByRole("dialog")).not.toContainText("analysing…", {
          timeout: 20000,
        });
        const reviewed = await saved(reopened);
        expect(Object.keys(reviewed.game.evals)).toHaveLength(reviewed.game.hist.length + 1);
        for (const value of Object.values(reviewed.game.evals))
          expect(value.review?.purpose).toBe("neutral-review");
        expect(reviewed.rating).toEqual(before.rating);
        expect(reviewed.game.opponent).toEqual(before.game.opponent);
        expect(reviewed.game.rated).toBe(profile !== "Morphy");
        expect(reviewed.game.ratingApplied).toBeNull();
        await reopened.getByRole("button", { name: "Close", exact: true }).click();
        // Review may finish at a preliminary depth on a slower runner. Stop passive
        // recomputation before testing exact save/replay equality across reload.
        await reopened.getByRole("button", { name: "Live", exact: true }).click();
        await expect.poll(async () => (await saved(reopened)).preferences.coach).toBe(false);
        await reopened.getByRole("button", { name: "Resign", exact: true }).click();
        await reopened
          .getByRole("dialog", { name: "Resign this game?" })
          .getByRole("button", { name: "Resign", exact: true })
          .click();
        await reopened.getByRole("button", { name: "View board", exact: true }).click();
        const completed = await saved(reopened);
        await reopened.screenshot({
          path: info.outputPath(`offline-${profile}-${color}-${info.project.name}.png`),
          fullPage: true,
        });
        await reopened.reload();
        await enterPlay(reopened);
        await reopened.getByRole("button", { name: "View board", exact: true }).click();
        await reopened.getByRole("button", { name: "Games", exact: true }).click();
        const records = reopened.getByRole("dialog", { name: "Recorded games" });
        await expect(records.getByRole("region", { name: "Recorded rivalry" })).toContainText(
          "1 recorded game",
        );
        await records.getByRole("button", { name: "Replay recorded game 1" }).click();
        await records.getByRole("slider", { name: "Replay position" }).press("End");
        await expect(records.getByRole("group", { name: "Chess board" })).toBeVisible();
        expect((await saved(reopened)).game).toEqual(completed.game);
        expect((await saved(reopened)).rating).toEqual(completed.rating);
      } finally {
        await origin.stop();
      }
    });

test("without a service worker, the stopped origin cannot reopen from HTTP cache", async ({
  browser,
}) => {
  const origin = await startOrigin();
  let context: BrowserContext | undefined;
  try {
    context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    await page.goto(origin.url);
    await enterPlay(page);
    await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
    expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(false);
    await origin.stop();
    const reopened = await context.newPage();
    await expect(reopened.goto(origin.url, { timeout: 10000 })).rejects.toThrow();
  } finally {
    try {
      await context?.close();
    } finally {
      await origin.stop();
    }
  }
});
