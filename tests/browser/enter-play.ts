import { expect, type Page } from "@playwright/test";
// Board-focused regressions navigate through the actual Home screen. The Home
// journey has its own suite; no production state or storage is bypassed here.
export async function enterPlay(page: Page) {
  if (new URL(page.url()).pathname !== "/") return;
  const home = page.getByRole("main", { name: "Chess Prodigy home" });
  await expect(home).toBeVisible();
  for (const name of ["Resume game", "View result", "View saved game", "New game"]) {
    const button = home.getByRole("button", { name, exact: true });
    if (await button.count()) {
      await button.click();
      return;
    }
  }
  throw new Error("Home has no playable navigation action");
}
