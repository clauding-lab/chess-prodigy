import { enterPlay } from "./enter-play";
import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
test.use({ baseURL: "http://127.0.0.1:4318" });
test("invitation survives registration and human moves update both boards and H2H", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(60000);
  const suffix = `${info.project.name}-${Date.now()}`;
  const ip = createHash("sha256").update(suffix).digest();
  await page.context().setExtraHTTPHeaders({ "CF-Connecting-IP": `192.1.${ip[0]}.${ip[1]}` });
  const signup = await page.request.post("/api/auth/sign-up/email", {
    data: {
      name: "Adnan",
      email: `adnan-${suffix}@example.com`,
      password: "correct horse battery staple",
    },
    headers: { Origin: "http://127.0.0.1:4318" },
  });
  expect(signup.ok()).toBeTruthy();
  await page.goto("/games");
  await enterPlay(page);
  await expect(page.getByRole("button", { name: "H2H", exact: true })).toHaveCount(0);
  await page.getByLabel("Your colour").selectOption("w");
  await page.getByRole("button", { name: "Create invitation" }).click();
  const link = await page.getByLabel("Invitation link").inputValue();
  const second = await browser.newContext({
    baseURL: "http://127.0.0.1:4318",
    extraHTTPHeaders: { "CF-Connecting-IP": `192.2.${ip[0]}.${ip[1]}` },
  });
  try {
    const other = await second.newPage();
    await other.goto(link);
    await enterPlay(other);
    await other.getByRole("button", { name: "Sign in or register" }).click();
    await other.getByRole("button", { name: "Create an account" }).click();
    await other.getByLabel("Display name").fill("Sayem");
    await other.getByLabel("Email").fill(`sayem-${suffix}@example.com`);
    await other.getByLabel("Password", { exact: true }).fill("correct horse battery staple");
    await other.getByRole("button", { name: "Create account", exact: true }).click();
    await expect(other.getByText("Adnan 0–0 Sayem", { exact: false })).toBeVisible();
    await expect(page.getByText("Your turn", { exact: true })).toBeVisible();
    await expect(page.locator(".brand img")).toBeVisible();
    const chat = page.getByRole("region", { name: "Match chat" });
    const otherChat = other.getByRole("region", { name: "Match chat" });
    await chat.getByLabel("Message", { exact: true }).fill("Good luck 🙂 <b>friend</b>");
    await expect(otherChat.getByText("Opponent is typing…")).toBeVisible();
    await chat.getByRole("button", { name: "Send", exact: true }).click();
    await expect(otherChat.getByText("Good luck 🙂 <b>friend</b>", { exact: true })).toBeVisible();
    await expect(otherChat.locator("b")).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(chat.getByRole("log")).not.toBeInViewport();
    await otherChat.getByLabel("Message", { exact: true }).fill("Your move, friend");
    await otherChat.getByRole("button", { name: "Send", exact: true }).click();
    const unread = page.getByRole("button", { name: "Chat, unread messages", exact: true });
    await expect(unread).toBeInViewport();
    await page.screenshot({ path: `/tmp/chess-unread-${info.project.name}.png` });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(unread.locator(".chat-unread-dot")).toHaveCSS("animation-name", "none");
    await unread.click();
    await expect(chat.getByRole("log")).toBeInViewport();
    await expect(unread).toHaveCount(0);
    await otherChat.getByLabel("Message", { exact: true }).fill("Still here");
    await otherChat.getByRole("button", { name: "Send", exact: true }).click();
    await expect(chat.getByText("Still here", { exact: true })).toBeVisible();
    await expect(unread).toHaveCount(0);
    await other.screenshot({ path: `/tmp/chess-chat-${info.project.name}.png`, fullPage: true });
    const matchUrl = other.url();
    await other.getByRole("button", { name: "My games", exact: true }).click();
    await expect(chat.getByText("Good luck 🙂 <b>friend</b>", { exact: true })).toHaveCount(0);
    await other.goto(matchUrl);
    await enterPlay(other);
    await expect(otherChat.getByLabel("Message", { exact: true })).toBeEnabled();
    await expect(otherChat.getByText("Good luck 🙂 <b>friend</b>", { exact: true })).toHaveCount(0);
    await page.screenshot({ path: "/tmp/chess-1v1-" + info.project.name + ".png", fullPage: true });
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
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
    await enterPlay(page);
    await expect(page.getByRole("button", { name: "e5, black pawn", exact: true })).toBeVisible();
    await other.getByRole("button", { name: "My games", exact: true }).click();
    await page.getByRole("button", { name: "Resign", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Resign", exact: true }).click();
    await expect(page.getByText("Adnan 0–1 Sayem", { exact: false })).toBeVisible();
    await expect(page.getByText(/1184/).first()).toBeVisible();
    await page.getByRole("button", { name: "H2H", exact: true }).click();
    const history = page.getByRole("dialog", { name: "Head to head", exact: true });
    await expect(history.getByRole("columnheader")).toHaveText([
      "Opponent",
      "Your wins",
      "Draws",
      "Your losses",
    ]);
    await expect(history.getByRole("row").nth(1).getByRole("cell")).toHaveText([
      "Sayem",
      "0",
      "0",
      "1",
    ]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    expect(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
        .violations,
    ).toEqual([]);
    await page.keyboard.press("Escape");
    await other.getByRole("button", { name: "H2H", exact: true }).click();
    await expect(
      other
        .getByRole("dialog", { name: "Head to head", exact: true })
        .getByRole("row")
        .nth(1)
        .getByRole("cell"),
    ).toHaveText(["Adnan", "1", "0", "0"]);
    await other.keyboard.press("Escape");
    await page.getByRole("button", { name: "Adnan", exact: true }).click();
    await page.getByRole("button", { name: "Edit name" }).click();
    await page.getByLabel("Display name").fill("Adnan Rashid");
    await page.getByRole("button", { name: "Save name" }).click();
    await expect(page.getByRole("dialog", { name: "Adnan Rashid", exact: true })).toBeVisible();
    await page.getByRole("dialog", { name: "Adnan Rashid", exact: true }).press("Escape");
    await expect(page.getByText("Adnan Rashid 0–1 Sayem", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Adnan Rashid", exact: true }).click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByRole("button", { name: "Sign in or register" })).toBeVisible();
    await expect(page.getByRole("button", { name: "H2H", exact: true })).toHaveCount(0);
  } finally {
    await second.close();
  }
});

test("a failed previous-account push cleanup blocks account entry", async ({ page }, info) => {
  const suffix = `${info.project.name}-${Date.now()}`;
  await page
    .context()
    .setExtraHTTPHeaders({
      "CF-Connecting-IP": info.project.name === "desktop" ? "192.3.1.9" : "192.3.1.10",
    });
  const signup = await page.request.post("/api/auth/sign-up/email", {
    data: {
      name: "New account",
      email: `blocked-${suffix}@example.com`,
      password: "correct horse battery staple",
    },
    headers: { Origin: "http://127.0.0.1:4318" },
  });
  expect(signup.ok()).toBeTruthy();
  await page.addInitScript(() => {
    localStorage.setItem("chess-push-owner", "previous-account");
    Object.defineProperty(navigator.serviceWorker, "getRegistration", {
      value: async () => ({
        pushManager: { getSubscription: async () => ({ unsubscribe: async () => false }) },
      }),
    });
  });
  await page.goto("/games");
  await enterPlay(page);
  await expect(page.getByRole("alert")).toContainText("Could not clear this device");
  await expect(page.getByRole("button", { name: "Create invitation" })).toHaveCount(0);
});
