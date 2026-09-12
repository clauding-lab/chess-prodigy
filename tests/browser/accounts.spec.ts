import { enterPlay } from "./enter-play";
import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";

test.use({ baseURL: "http://127.0.0.1:4318" });

test.beforeEach(async ({ context }, info) => {
  // Model separate clients at the local tunnel origin without disabling production limits.
  const bytes = createHash("sha256")
    .update(info.project.name + info.testId)
    .digest();
  await context.setExtraHTTPHeaders({ "CF-Connecting-IP": `192.0.${bytes[0]}.${bytes[1]}` });
});

const password = "correct horse battery staple";

async function createAccount(page: import("@playwright/test").Page, name: string, email: string) {
  const setup = page.getByRole("dialog", { name: "New game" });
  await setup.getByRole("button", { name: "Sign in" }).click();
  const auth = page.getByRole("dialog", { name: "Sign in" });
  await auth.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Display name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  await enterPlay(page);
  await expect(
    page.getByRole("dialog", { name: "New game" }).getByRole("button", { name }),
  ).toBeVisible();
}

async function signInAccount(page: import("@playwright/test").Page, email: string) {
  await page
    .getByRole("dialog", { name: "New game" })
    .getByRole("button", { name: "Sign in" })
    .click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page
    .getByRole("dialog", { name: "Sign in" })
    .getByRole("button", { name: "Sign in" })
    .click();
  await expect(page.getByRole("dialog", { name: "Sign in", exact: true })).toHaveCount(0);
  await enterPlay(page);
}

test("account records restore on another session while guest play stays isolated", async ({
  page,
  browser,
}, info) => {
  const suffix = `${info.project.name}-${Date.now()}`;
  const name = `Player ${suffix}`;
  const email = `${suffix}@example.com`;
  await page.goto("/");
  await enterPlay(page);
  await createAccount(page, name, email);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "e2, white pawn" }).click();
  await page.getByRole("button", { name: "e4, empty" }).click();
  await expect(page.locator(".status")).toContainText("Your move");
  await page.getByRole("button", { name: "Resign", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Resign this game?" })
    .getByRole("button", { name: "Resign" })
    .click();
  await expect(page.getByRole("dialog", { name: "Resignation" })).toBeVisible();
  await expect(page.getByText("Saved to account", { exact: true }).first()).toBeVisible();

  const other = await browser.newContext();
  // A slow initial account lookup must not make an uninitialized guest save our baseline.
  await other.route("**/api/auth/get-session", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.continue();
  });
  const second = await other.newPage();
  await second.goto("/");
  await enterPlay(second);
  await expect(second.getByRole("dialog", { name: "New game" })).toBeVisible();
  await expect
    .poll(() => second.evaluate(() => localStorage.getItem("chess-prodigy-state-v3")))
    .not.toBeNull();
  const guestBefore = await second.evaluate(() => localStorage.getItem("chess-prodigy-state-v3"));
  await second
    .getByRole("dialog", { name: "New game" })
    .getByRole("button", { name: "Sign in" })
    .click();
  await second.getByLabel("Email").fill(email);
  await second.getByLabel("Password").fill(password);
  await second
    .getByRole("dialog", { name: "Sign in" })
    .getByRole("button", { name: "Sign in" })
    .click();
  await expect(second.getByRole("dialog", { name: "Sign in", exact: true })).toHaveCount(0);
  await enterPlay(second);
  await expect(second.getByRole("dialog", { name: "Resignation" })).toBeVisible();
  await second.getByRole("button", { name: "View board" }).click();
  await second.getByRole("button", { name }).click();
  await expect(second.getByRole("dialog", { name })).toContainText("Resignation");
  await second.getByRole("button", { name: "Sign out" }).click();
  await expect(second.getByRole("button", { name: "Sign in" }).first()).toBeVisible();
  expect(await second.evaluate(() => localStorage.getItem("chess-prodigy-state-v3"))).toBe(
    guestBefore,
  );
  await other.close();

  await page.getByRole("button", { name: "View board" }).click();
  await page.getByRole("button", { name: "Leaderboard" }).first().click();
  const leaderboard = page.getByRole("dialog", { name: "Leaderboard" });
  await expect(leaderboard).toContainText(name);
  await expect(leaderboard).not.toContainText(email);
});

test("registration explains public fields and rejects a short password", async ({ page }, info) => {
  await page.goto("/");
  await enterPlay(page);
  await page
    .getByRole("dialog", { name: "New game" })
    .getByRole("button", { name: "Sign in" })
    .click();
  await page.getByRole("button", { name: "Create an account" }).click();
  await expect(page.getByRole("dialog", { name: "Create account" })).toContainText(
    "1v1 Rating and game counts will be public",
  );
  await page.getByLabel("Display name").fill(`Bounds ${info.project.name}`);
  await page.getByLabel("Email").fill(`bounds-${info.project.name}-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("too-short");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Create account" })).toBeVisible();
});

test("a tab mounted for one account cannot sync after the shared browser session changes", async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name === "mobile", "Account switch race is covered once in desktop.");
  const suffix = `switch-${info.project.name}-${Date.now()}`;
  await page.goto("/");
  await enterPlay(page);
  await createAccount(page, `Old ${suffix}`, `old-${suffix}@example.com`);

  const replacement = await context.newPage();
  await replacement.goto("/");
  await enterPlay(replacement);
  await replacement
    .getByRole("dialog", { name: "New game" })
    .getByRole("button", { name: `Old ${suffix}` })
    .click();
  await replacement.getByRole("button", { name: "Sign out" }).click();
  await enterPlay(replacement);
  await createAccount(replacement, `New ${suffix}`, `new-${suffix}@example.com`);
  await replacement.waitForTimeout(1200);

  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "e2, white pawn" }).click();
  await page.getByRole("button", { name: "e4, empty" }).click();
  await expect(page.getByRole("button", { name: "Sign in again" }).first()).toBeVisible({
    timeout: 5000,
  });

  const replacementSession = await replacement.evaluate(async () =>
    fetch("/api/auth/get-session").then((response) => response.json()),
  );
  const records = await replacement.evaluate(async (userId) => {
    const response = await fetch("/api/records", {
      headers: { "X-Chess-Account": userId },
    });
    return { status: response.status, body: await response.json() };
  }, replacementSession.user.id);
  expect(records.status).toBe(200);
  expect(records.body.snapshot).toBeNull();
});

test("a cloud conflict stays actionable above an open setup dialog", async ({
  page,
  browser,
}, info) => {
  test.skip(info.project.name === "mobile", "Conflict stacking is covered once in desktop.");
  const suffix = `conflict-${info.project.name}-${Date.now()}`;
  const email = `${suffix}@example.com`;
  await page.goto("/");
  await enterPlay(page);
  await createAccount(page, `Conflict ${suffix}`, email);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "e2, white pawn" }).click();
  await page.getByRole("button", { name: "e4, empty" }).click();
  await expect(page.locator(".status")).toContainText("Your move");
  await page.waitForTimeout(1200);

  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await other.goto("/");
  await enterPlay(other);
  await signInAccount(other, email);

  await page.getByRole("button", { name: "Wooden board" }).click();
  await page.waitForTimeout(1200);
  await other.getByRole("button", { name: "Wooden board" }).click();
  await other.getByRole("button", { name: "New game", exact: true }).click();
  const conflict = other.getByRole("dialog", { name: "Progress changed on another device" });
  await expect(conflict).toBeVisible({ timeout: 5000 });
  await expect(other.getByRole("dialog", { name: "Finish your current game?" })).toBeVisible();
  await conflict.getByRole("button", { name: "Use cloud copy" }).click();
  await expect(conflict).toHaveCount(0);
  await otherContext.close();
});

test("returning preferences to their initial value still syncs the final choice", async ({
  page,
}, info) => {
  test.skip(
    info.project.name === "mobile",
    "Preference sync regression is covered once in desktop.",
  );
  const suffix = `preference-${Date.now()}`;
  await page.goto("/");
  await enterPlay(page);
  await createAccount(page, `Preference ${suffix}`, `${suffix}@example.com`);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "e2, white pawn" }).click();
  await page.getByRole("button", { name: "e4, empty" }).click();
  await expect(page.locator(".status")).toContainText("Your move");
  await expect(page.getByText("Pending changes")).toBeVisible();
  await expect(page.getByText("Saved to account")).toBeVisible({ timeout: 5000 });
  await page.reload();
  await enterPlay(page);
  await page.getByRole("button", { name: "Wooden board" }).click();
  await expect(page.getByText("Pending changes")).toBeVisible();
  await expect(page.getByText("Saved to account")).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: "Dark board" }).click();
  await expect(page.getByText("Pending changes")).toBeVisible();
  await expect(page.getByText("Saved to account")).toBeVisible({ timeout: 5000 });
  await page.reload();
  await enterPlay(page);
  await expect(page.getByRole("button", { name: "Wooden board" })).toBeVisible();
});
