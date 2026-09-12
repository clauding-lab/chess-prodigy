import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
);

test("About is accessible from Home, nested setup and offline play", async ({ page, context }) => {
  await page.goto("/");
  const about = page.getByRole("button", { name: "About", exact: true });
  await about.click();
  const dialog = page.getByRole("dialog", { name: "About Chess Prodigy" });
  await expect(dialog).toContainText(`Version ${version}`);
  await expect(dialog).toContainText("Developed by Adnan Rashid");
  const github = dialog.getByRole("link", { name: "View on GitHub" });
  await expect(github).toHaveAttribute("href", "https://github.com/clauding-lab/chess-prodigy");
  await expect(github).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Close", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(about).toBeFocused();

  await page.getByRole("button", { name: "New game", exact: true }).click();
  const setup = page.getByRole("dialog", { name: "New game", exact: true });
  await setup.getByRole("button", { name: "About", exact: true }).click();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(setup.getByRole("button", { name: "About", exact: true })).toBeFocused();
  await setup.getByRole("button", { name: "Start", exact: true }).click();
  await context.setOffline(true);
  await about.click();
  await expect(dialog).toContainText(`Version ${version}`);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("button", { name: "e2, white pawn" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
