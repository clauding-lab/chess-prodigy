import { enterPlay } from "./enter-play";
import { expect, test } from "@playwright/test";
import { freshSession, reduceSession } from "../../src/game/state";
import { applyMove, legalMoves, sanFor } from "../../src/engine/board";

function savedGame() {
  let session = freshSession(Date.now(), "coaching-browser");
  for (const san of ["b3", "e5", "Bb2", "Nc6"]) {
    const move = legalMoves(session.game.st).find(
      (m) => sanFor(session.game.st, m, applyMove(session.game.st, m)) === san,
    )!;
    session = reduceSession(session, { type: "move", move, book: true, now: Date.now() });
  }
  return session;
}

test("opening and earlier move stories stay readable through play and a saved-game reload", async ({
  page,
}, info) => {
  await page.addInitScript((session) => {
    if (!localStorage.getItem("chess-prodigy-state-v5"))
      localStorage.setItem("chess-prodigy-state-v5", JSON.stringify(session));
  }, savedGame());
  await page.goto("/");
  await enterPlay(page);
  const opening = page.getByRole("button", { name: /About this opening/ });
  const fianchetto = page.getByRole("button", { name: /2\. Bb2 · Fianchetto/ });
  await expect(opening).toHaveAttribute("aria-expanded", "true");
  await fianchetto.click();
  await expect(fianchetto).toHaveAttribute("aria-expanded", "true");
  await expect(opening).toHaveAttribute("aria-expanded", "true");
  const source = page.getByRole("link", { name: /Nimzowitsch-Larsen/ });
  await expect(source).toHaveAttribute("target", "_blank");
  expect(await source.evaluate((link) => link.closest("button"))).toBeNull();
  await page.getByRole("button", { name: "g1, white knight" }).click();
  await page.getByRole("button", { name: "f3, empty" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("chess-prodigy-state-v5")!).game.hist.length,
      ),
    )
    .toBe(6);
  await expect(fianchetto).toHaveAttribute("aria-expanded", "true");
  await page.reload();
  await enterPlay(page);
  await expect(fianchetto).toBeVisible();
  await fianchetto.click();
  await expect(page.getByRole("link", { name: /hypermodern school/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const reading = page.getByRole("region", { name: "Opening and coaching history" });
  expect(await reading.evaluate((element) => getComputedStyle(element).overflowY)).toBe(
    info.project.name === "mobile" ? "visible" : "auto",
  );
  await reading.screenshot({ path: `docs/verification/${info.project.name}-coaching.png` });
  await page.getByRole("button", { name: "New game", exact: true }).click();
  await page.getByRole("button", { name: "Forfeit and continue", exact: true }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(fianchetto).toHaveCount(0);
});

test("a legal move slides before the engine replies, with reduced-motion support", async ({
  page,
}) => {
  await page.goto("/");
  await enterPlay(page);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  const motion = await page.evaluate(async () => {
    const square = (name: string) =>
      document.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;
    square("e2, white pawn").click();
    await new Promise(requestAnimationFrame);
    square("e4, empty").click();
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    const piece = document.querySelector('button[aria-label="e4, white pawn"] .pc')!;
    const animation = piece.getAnimations()[0];
    return {
      duration: animation?.effect?.getTiming().duration,
      transform: getComputedStyle(piece).transform,
      moves: JSON.parse(localStorage.getItem("chess-prodigy-state-v5")!).game.hist.length,
    };
  });
  expect(motion.duration).toBe(350);
  expect(motion.transform).not.toBe("none");
  expect(motion.moves).toBe(1);
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("chess-prodigy-state-v5")!).game.hist.length,
      ),
    )
    .toBe(2);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "e2, white pawn" }).click();
  await page.getByRole("button", { name: "e4, empty" }).click();
  expect(
    await page
      .locator(".pc")
      .evaluateAll((pieces) => pieces.flatMap((piece) => piece.getAnimations()).length),
  ).toBe(0);
});
