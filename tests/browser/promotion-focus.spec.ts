import { test, expect } from "@playwright/test";
import { freshSession } from "../../src/game/state";
import { playLine } from "../game/play-line";
import { SAVE_KEY } from "../../src/storage/store";

test("keyboard promotion restores focus to the board after the modal closes", async ({ page }) => {
  const session = playLine(freshSession(Date.now(), "keyboard-promotion"), [
    "a4",
    "h5",
    "a5",
    "h4",
    "a6",
    "h3",
    "axb7",
    "hxg2",
  ]);
  session.preferences.coach = false;
  await page.addInitScript(
    ({ key, session }) => localStorage.setItem(key, JSON.stringify(session)),
    { key: SAVE_KEY, session },
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Resume game", exact: true }).click();
  const origin = page.locator(".sq").nth(9);
  await origin.focus();
  await origin.press("Enter");
  await origin.press("ArrowUp");
  const b8 = page.locator(".sq").nth(1);
  await b8.press("ArrowLeft");
  const a8 = page.locator(".sq").nth(0);
  await a8.press("Enter");
  const dialog = page.getByRole("dialog", { name: /promot/i });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Promote to queen", exact: true }).press("Enter");
  await expect(dialog).not.toBeVisible();
  await expect(a8).toBeFocused();
  await expect(page.locator(".movelist")).toContainText("bxa8=Q");
  await expect(page.locator(".status")).toContainText("Your move");
  await expect(a8).toBeFocused();
  await a8.press("ArrowRight");
  await expect(b8).toBeFocused();
});
