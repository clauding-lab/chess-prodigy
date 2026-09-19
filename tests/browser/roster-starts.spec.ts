import { expect, test } from "@playwright/test";
import { SAVE_KEY } from "../../src/storage/store";
import type { Session } from "../../src/game/types";

const opponents = [
  {
    name: "Paul Morphy",
    id: "attack-development",
    version: 4,
    engine: "plans-v1",
    ratings: [1225, 1400, 1625],
  },
  {
    name: "Boris Spassky",
    id: "spassky",
    version: 1,
    engine: "spassky-plans-v1",
    ratings: [1150, 1325, 1700],
  },
  {
    name: "Mikhail Tal",
    id: "tal",
    version: 1,
    engine: "tal-plans-v1",
    ratings: [1200, 1325, 1700],
  },
  {
    name: "Bobby Fischer",
    id: "fischer",
    version: 1,
    engine: "fischer-plans-v1",
    ratings: [1250, 1350, 1675],
  },
] as const;

for (const opponent of opponents)
  for (const [index, level] of [...["Casual", "Club", "Strong"].entries()].filter(
    ([, level]) => opponent.id !== "attack-development" || level !== "Casual",
  ))
    for (const color of ["White", "Black"] as const)
      test(`normal start ${opponent.name} ${level} ${color} preserves identity and settles its measured receipt`, async ({
        page,
      }, info) => {
        test.skip(
          process.env.VITE_PERSONALITY_BETA !== "true",
          "Historical setup is intentionally default-off.",
        );
        const saved = (): Promise<Session> =>
          page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
        await page.goto("/");
        await page.getByRole("button", { name: `Play ${opponent.name}`, exact: true }).click();
        const setup = page.getByRole("dialog", { name: "New game", exact: true });
        await setup
          .getByRole("button", { name: `${level} ${opponent.ratings[index]}`, exact: true })
          .click();
        await setup.getByRole("button", { name: color, exact: true }).click();
        await setup.getByRole("button", { name: "No clock", exact: true }).click();
        await setup.getByRole("button", { name: "Start", exact: true }).click();
        if (color === "White") {
          await page.getByRole("button", { name: "e2, white pawn", exact: true }).click();
          await page.getByRole("button", { name: "e4, empty", exact: true }).click();
        }
        await expect
          .poll(async () => (await saved()).game.hist.length)
          .toBe(color === "White" ? 2 : 1);
        const active = await saved();
        expect(active.game.opponent).toMatchObject({
          id: opponent.id,
          version: opponent.version,
          engine: opponent.engine,
        });
        expect(active.game.setup).toMatchObject({
          level: level.toLowerCase(),
          playerColor: color === "White" ? "w" : "b",
          time: "none",
        });
        expect(active.game.unratedReason).toBeNull();
        expect(active.game.ratingApplied).toBeNull();
        if (level === "Casual" && color === "White")
          await page.screenshot({
            path: info.outputPath(`play-${opponent.id}.png`),
            fullPage: true,
          });
        await page.getByRole("button", { name: "Resign", exact: true }).click();
        await page
          .getByRole("dialog", { name: "Resign this game?" })
          .getByRole("button", { name: "Resign", exact: true })
          .click();
        await expect.poll(async () => (await saved()).rating.games).toBe(1);
        const ended = await saved();
        // Fresh players start at the preserved 1400 floor: a rated loss records zero delta.
        expect(ended.rating.rating).toBe(1400);
        expect(ended.game.ratingApplied).toMatchObject({
          gameId: active.game.id,
          before: active.rating,
          after: ended.rating.rating,
          delta: ended.rating.rating - active.rating.rating,
        });
        expect(ended.rating.history.at(-1)).toMatchObject({
          oppRating: opponent.ratings[index],
          score: 0,
        });
        await page.reload();
        expect((await saved()).rating.games).toBe(1);
      });
