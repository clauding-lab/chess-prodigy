import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
test.use({ baseURL: "http://127.0.0.1:4318" });
test("invitation survives registration and human moves update both boards and H2H", async ({ page, browser }, info) => {
  const suffix = `${info.project.name}-${Date.now()}`;
  const ip = createHash("sha256").update(suffix).digest();
  await page.context().setExtraHTTPHeaders({ "CF-Connecting-IP": `192.1.${ip[0]}.${ip[1]}` });
  const signup = await page.request.post("/api/auth/sign-up/email", { data: { name: "Adnan", email: `adnan-${suffix}@example.com`, password: "correct horse battery staple" }, headers: { Origin: "http://127.0.0.1:4318" } });
  expect(signup.ok()).toBeTruthy();
  await page.goto("/games");
  await page.getByLabel("Your colour").selectOption("w");
  await page.getByRole("button", { name: "Create invitation" }).click();
  const link = await page.getByLabel("Invitation link").inputValue();
  const second = await browser.newContext({ baseURL: "http://127.0.0.1:4318", extraHTTPHeaders: { "CF-Connecting-IP": `192.2.${ip[0]}.${ip[1]}` } });
  try {
    const other = await second.newPage();
    await other.goto(link);
    await other.getByRole("button", { name: "Sign in or register" }).click();
    await other.getByRole("button", { name: "Create an account" }).click();
    await other.getByLabel("Display name").fill("Sayem");
    await other.getByLabel("Email").fill(`sayem-${suffix}@example.com`);
    await other.getByLabel("Password", { exact: true }).fill("correct horse battery staple");
    await other.getByRole("button", { name: "Create account", exact: true }).click();
    await expect(other.getByText("Adnan 0–0 Sayem", { exact: false })).toBeVisible();
    await expect(page.getByText("Your turn", { exact: true })).toBeVisible();
    await page.screenshot({ path: '/tmp/chess-1v1-' + info.project.name + '.png', fullPage: true });
    const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(accessibility.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.route("**/api/multiplayer/*/move", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3500));
      await route.continue();
    });
    await page.getByRole("button", { name: "e2, white pawn", exact: true }).click();
    await page.getByRole("button", { name: "e4, empty", exact: true }).click();
    await expect(other.getByText("Your turn", { exact: true })).toBeVisible({ timeout: 10000 });
    await other.getByRole("button", { name: "e7, black pawn", exact: true }).click();
    await other.getByRole("button", { name: "e5, empty", exact: true }).click();
    await expect(page.getByText("Your turn", { exact: true })).toBeVisible({ timeout: 10000 });
    await page.reload();
    await expect(page.getByRole("button", { name: "e5, black pawn", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Resign", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Resign", exact: true }).click();
    await expect(page.getByText("Adnan 0–1 Sayem", { exact: false })).toBeVisible();
    await expect(page.getByText(/1184/).first()).toBeVisible();
    await page.getByRole("button", { name: "Adnan", exact: true }).click();
    await page.getByRole("button", { name: "Edit name" }).click();
    await page.getByLabel("Display name").fill("Adnan Rashid");
    await page.getByRole("button", { name: "Save name" }).click();
    await expect(page.getByRole("dialog", { name: "Adnan Rashid", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByText("Adnan Rashid 0–1 Sayem", { exact: false })).toBeVisible();
  } finally { await second.close(); }
});

test("a failed previous-account push cleanup blocks account entry", async ({ page }, info) => {
  const suffix = `${info.project.name}-${Date.now()}`;
  await page.context().setExtraHTTPHeaders({ "CF-Connecting-IP": info.project.name === "desktop" ? "192.3.1.9" : "192.3.1.10" });
  const signup = await page.request.post("/api/auth/sign-up/email", { data: { name: "New account", email: `blocked-${suffix}@example.com`, password: "correct horse battery staple" }, headers: { Origin: "http://127.0.0.1:4318" } });
  expect(signup.ok()).toBeTruthy();
  await page.addInitScript(() => {
    localStorage.setItem("chess-push-owner", "previous-account");
    Object.defineProperty(navigator.serviceWorker, "getRegistration", { value: async () => ({ pushManager: { getSubscription: async () => ({ unsubscribe: async () => false }) } }) });
  });
  await page.goto("/games");
  await expect(page.getByRole("alert")).toContainText("Could not clear this device");
  await expect(page.getByRole("button", { name: "Create invitation" })).toHaveCount(0);
});
