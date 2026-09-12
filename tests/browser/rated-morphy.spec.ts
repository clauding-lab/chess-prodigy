import { enterPlay } from "./enter-play";
import { expect, test } from "@playwright/test";
import { freshSession, reduceSession } from "../../src/game/state";
import { ratedMorphyConfig, historicalMorphyConfig } from "../../src/engine/opponents";

for (const version of [2, 3] as const)
  test(`account Morphy v${version} completion syncs its measured receipt once and restores its private archive`, async ({
    page,
  }, info) => {
    const origin = "http://127.0.0.1:4318",
      suffix = `${info.project.name}-${Date.now()}`;
    const registration = await page.request.post(`${origin}/api/auth/sign-up/email`, {
      headers: { Origin: origin },
      data: {
        name: `Morphy ${suffix}`,
        email: `morphy-${suffix}@example.com`,
        password: "correct horse battery staple",
      },
    });
    expect(registration.status()).toBe(200);
    const { user } = await registration.json();
    const session = reduceSession(freshSession(Date.now(), "initial"), {
      type: "new",
      id: `measured-v${version}-${suffix}`,
      now: Date.now(),
      setup: {
        playerColor: "w",
        level: "club",
        time: "none",
        opponent: (version === 2 ? ratedMorphyConfig : historicalMorphyConfig)(91),
      },
    });
    const headers = {
      Origin: origin,
      "X-Chess-Account": user.id,
      "X-Chess-Rating-Policy": version === 2 ? "1" : "2",
    };
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
    await expect(page.getByText("Paul Morphy · Club", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "e2, white pawn", exact: true }).click();
    await page.getByRole("button", { name: "e4, empty", exact: true }).click();
    await expect(page.locator(".status")).toContainText("Your move");
    await page.getByRole("button", { name: "Resign", exact: true }).click();
    await page
      .getByRole("dialog", { name: "Resign this game?" })
      .getByRole("button", { name: "Resign", exact: true })
      .click();
    await expect(page.getByRole("dialog", { name: "Resignation" })).toBeVisible();
    await expect(page.getByText("Saved to account", { exact: true }).first()).toBeVisible();
    const read = async () => {
      const response = await page.request.get(`${origin}/api/records`, { headers });
      expect(response.status()).toBe(200);
      return response.json();
    };
    await expect.poll(async () => (await read()).snapshot.rating.games).toBe(1);
    const before = await read();
    expect(before.snapshot.rating.history.at(-1)).toMatchObject({
      opp: "Paul Morphy · Club",
      oppRating: 1375,
      score: 0,
    });
    expect(before.games).toHaveLength(1);
    expect(before.games[0]).toMatchObject({
      rated: true,
      opponent: { version },
      unratedReason: null,
    });
    if (version === 3) {
      for (const olderPolicy of [undefined, "1"]) {
        const rejected = await page.request.put(origin + "/api/records", {
          headers: {
            Origin: origin,
            "X-Chess-Account": user.id,
            ...(olderPolicy ? { "X-Chess-Rating-Policy": olderPolicy } : {}),
          },
          data: {
            expectedVersion: before.version,
            snapshot: freshSession(Date.now(), "older-client"),
          },
        });
        expect(rejected.status()).toBe(426);
        expect(await read()).toEqual(before);
      }
    }
    await page.reload();
    await enterPlay(page);
    await expect(page.getByRole("dialog", { name: "Resignation" })).toBeVisible();
    const restored = await read();
    expect(restored.snapshot.rating).toEqual(before.snapshot.rating);
    expect(restored.snapshot.game.opponent).toEqual(before.snapshot.game.opponent);
    expect(restored.snapshot.game.ratingApplied).toEqual(before.snapshot.game.ratingApplied);
    expect(restored.games).toHaveLength(1);
    expect(restored.games[0].id).toBe(before.games[0].id);
    await page.getByRole("button", { name: "View board", exact: true }).click();
    await page.getByRole("button", { name: "Games", exact: true }).click();
    await page.getByRole("button", { name: "Replay recorded game 1", exact: true }).click();
    await expect(page.getByRole("region", { name: "Recorded game replay" })).toBeVisible();
  });
