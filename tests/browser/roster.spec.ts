import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ROSTER_IDS, ROSTER_NAMES, rosterConfig } from "../../src/engine/opponents";
import { SAVE_KEY } from "../../src/storage/store";
import { legalMoves, sqName } from "../../src/engine/board";
import { freshSession, reduceSession } from "../../src/game/state";
import type { Session } from "../../src/game/types";
import { enterPlay } from "./enter-play";
const saved = (page: Page): Promise<Session> =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
async function move(page: Page, from: string, to: string) {
  await page.getByRole("button", { name: new RegExp(`^${from},`) }).click();
  await page.getByRole("button", { name: new RegExp(`^${to},`) }).click();
}
test("roster cards honor the build flag and expose measured starts", async ({ page }, info) => {
  await page.goto("/");
  await expect(page.locator(".app")).toHaveAttribute("data-theme", "dark");
  for (const id of ROSTER_IDS) {
    const button = page.getByRole("button", { name: `Play ${ROSTER_NAMES[id]}`, exact: true });
    if (process.env.VITE_PERSONALITY_BETA !== "true") await expect(button).toHaveCount(0);
    else {
      await expect(button).toBeEnabled();
      await expect(
        page.getByRole("link", { name: new RegExp(`${ROSTER_NAMES[id]} on Wikipedia`) }),
      ).toHaveAttribute("rel", "noopener noreferrer");
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath("roster-home.png"), fullPage: true });
  await page.getByRole("button", { name: "Play Classic", exact: true }).click();
  for (const id of ROSTER_IDS) {
    const button = page
      .getByRole("dialog", { name: "New game" })
      .getByRole("button", { name: ROSTER_NAMES[id], exact: true });
    if (process.env.VITE_PERSONALITY_BETA !== "true") await expect(button).toHaveCount(0);
    else await expect(button).toBeEnabled();
  }
});
for (const id of ROSTER_IDS)
  for (const level of ["casual", "club", "strong"] as const)
    for (const color of ["w", "b"] as const)
      test(`${id} ${level} ${color}: rated native worker, offline resume, neutral review and recorded rematch`, async ({
        page,
        context,
      }, info) => {
        const session = reduceSession(freshSession(Date.now(), "before"), {
          type: "new",
          id: `${id}-${level}-${color}`,
          now: Date.now(),
          setup: {
            playerColor: color,
            level,
            time: level === "club" ? "10+0" : "none",
            opponent: rosterConfig(id, 271),
          },
        });
        session.preferences.coach = false;
        await page.addInitScript(
          ({ key, session }) => {
            if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(session));
            const host = window as unknown as {
              __rosterWorkers: Array<{ url: string; type: string; elapsed: number; ok: boolean }>;
            };
            host.__rosterWorkers = [];
            const NativeWorker = window.Worker;
            window.Worker = class extends NativeWorker {
              constructor(url: string | URL, options?: WorkerOptions) {
                const started = performance.now();
                super(url, options);
                this.addEventListener("message", (event) => {
                  host.__rosterWorkers.push({
                    url: String(url),
                    type: event.data.type,
                    elapsed: performance.now() - started,
                    ok: event.data.ok,
                  });
                });
              }
            };
          },
          { key: SAVE_KEY, session },
        );
        await page.goto("/");
        await enterPlay(page);
        if (color === "w") await move(page, "e2", "e4");
        await expect
          .poll(async () => (await saved(page)).game.hist.length)
          .toBe(color === "w" ? 2 : 1);
        const before = await saved(page);
        expect(before.game.opponent).toEqual(session.game.opponent);
        expect(before.game.rated).toBe(true);
        const timings = () =>
          page.evaluate(
            () =>
              (
                window as unknown as {
                  __rosterWorkers: Array<{
                    url: string;
                    type: string;
                    elapsed: number;
                    ok: boolean;
                  }>;
                }
              ).__rosterWorkers,
          );
        const online = await timings();
        expect(online.filter((r) => r.type === "ai")).toHaveLength(1);
        expect(online[0].url).toContain(`${id}.worker-`);
        expect(online[0].elapsed).toBeLessThan({ casual: 1200, club: 1600, strong: 3000 }[level]);
        await page.evaluate(async () => {
          await navigator.serviceWorker.ready;
        });
        await context.setOffline(true);
        await page.reload();
        await enterPlay(page);
        expect((await saved(page)).game.opponent).toEqual(before.game.opponent);
        const candidate = legalMoves(before.game.st).find((m) => !m.promo)!;
        await move(page, sqName(candidate.from), sqName(candidate.to));
        await expect
          .poll(async () => (await saved(page)).game.hist.length)
          .toBe(before.game.hist.length + 2);
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
        const offline = await timings();
        expect(offline.filter((r) => r.type === "ai")).toHaveLength(1);
        expect(offline.find((r) => r.type === "ai")!.elapsed).toBeLessThan(
          { casual: 1200, club: 1600, strong: 3000 }[level],
        );
        expect([...online, ...offline].every((r) => r.ok)).toBe(true);
        expect(offline.find((r) => r.type === "ai")?.url).toContain(`${id}.worker-`);
        expect(
          offline
            .filter((r) => r.type === "analyse")
            .every((r) => r.url.includes("engine.worker-")),
        ).toBe(true);
        await info.attach("native-worker-startup.json", {
          body: JSON.stringify({ id, level, color, online, offline }),
          contentType: "application/json",
        });
        await page.getByRole("button", { name: "Close", exact: true }).click();
        await page.getByRole("button", { name: "Resign", exact: true }).click();
        await page
          .getByRole("dialog", { name: "Resign this game?" })
          .getByRole("button", { name: "Resign", exact: true })
          .click();
        await page.getByRole("button", { name: "View board", exact: true }).click();
        await page.getByRole("button", { name: "Games", exact: true }).click();
        const records = page.getByRole("dialog", { name: "Recorded games" });
        const rematch = records.getByRole("button", {
          name: "Rematch recorded game 1",
          exact: true,
        });
        if (process.env.VITE_PERSONALITY_BETA === "true") await expect(rematch).toBeEnabled();
        else await expect(rematch).toBeDisabled();
        await records.getByRole("button", { name: "Replay recorded game 1", exact: true }).click();
        await expect(records.getByRole("region", { name: "Recorded game replay" })).toBeVisible();
        expect((await saved(page)).rating.games).toBe(before.rating.games + 1);
        await context.setOffline(false);
      });

for (const id of ROSTER_IDS)
  test(`account ${id} preserves an assisted unrated archive and policy5 after reset`, async ({
    page,
    context,
  }, info) => {
    const origin = "http://127.0.0.1:4318",
      suffix = `${id}-${info.project.name}-${Date.now()}`;
    const bytes = createHash("sha256").update(suffix).digest();
    await context.setExtraHTTPHeaders({ "CF-Connecting-IP": `192.0.${bytes[0]}.${bytes[1]}` });
    const registration = await page.request.post(`${origin}/api/auth/sign-up/email`, {
      headers: { Origin: origin },
      data: {
        name: `Roster ${id}`,
        email: `${suffix}@example.com`,
        password: "correct horse battery staple",
      },
    });
    expect(registration.status()).toBe(200);
    const { user } = await registration.json();
    let session = reduceSession(freshSession(Date.now(), "before"), {
      type: "new",
      id: suffix,
      now: Date.now(),
      setup: { playerColor: "w", level: "casual", time: "none", opponent: rosterConfig(id, 19) },
    });
    session = reduceSession(session, {
      type: "move",
      move: legalMoves(session.game.st)[0],
      book: false,
      now: Date.now(),
    });
    session = reduceSession(session, {
      type: "move",
      move: legalMoves(session.game.st)[0],
      book: false,
      now: Date.now(),
    });
    session = reduceSession(session, { type: "hint" });
    const headers = { Origin: origin, "X-Chess-Account": user.id, "X-Chess-Rating-Policy": "5" };
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
    await expect(page.getByText(`${ROSTER_NAMES[id]} · Casual`, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Resign", exact: true }).click();
    await page
      .getByRole("dialog", { name: "Resign this game?" })
      .getByRole("button", { name: "Resign", exact: true })
      .click();
    const read = async () => {
      const r = await page.request.get(`${origin}/api/records`, { headers });
      expect(r.status()).toBe(200);
      return r.json();
    };
    await expect.poll(async () => (await read()).games.length).toBe(1);
    const ended = await read();
    expect(ended.snapshot.rating.games).toBe(0);
    expect(ended.games[0]).toMatchObject({
      opponent: session.game.opponent,
      rated: false,
      assisted: true,
    });
    await page.reload();
    await enterPlay(page);
    await page.getByRole("button", { name: "View board", exact: true }).click();
    await page.getByRole("button", { name: "Games", exact: true }).click();
    const rematch = page.getByRole("button", { name: "Rematch recorded game 1", exact: true });
    if (process.env.VITE_PERSONALITY_BETA === "true") await expect(rematch).toBeEnabled();
    else await expect(rematch).toBeDisabled();
    await page.getByRole("button", { name: "Replay recorded game 1", exact: true }).click();
    await expect(page.getByRole("region", { name: "Recorded game replay" })).toBeVisible();
    await expect(page.getByText("Saved to account", { exact: true })).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY)).toBeNull();
    // Close the UI before the independent-client write; review persistence may have advanced the counter.
    await page.goto("about:blank");
    const current = await read();
    const reset = reduceSession(freshSession(Date.now(), "reset"), { type: "resetRating" });
    expect(
      (
        await page.request.put(`${origin}/api/records`, {
          headers,
          data: { expectedVersion: current.version, snapshot: reset },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await page.request.put(`${origin}/api/records`, {
          headers: { ...headers, "X-Chess-Rating-Policy": "4" },
          data: { expectedVersion: current.version + 1, snapshot: reset },
        })
      ).status(),
    ).toBe(426);
    await context.clearCookies();
    expect((await page.request.get(`${origin}/api/records`, { headers })).status()).toBe(401);
  });
