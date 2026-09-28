import { expect, test } from "@playwright/test";
import { enterPlay } from "./enter-play";
const stateKey = "chess-prodigy-state-v9";

test("guest takeover reloads the last move and revokes the previous writer", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await enterPlay(page);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "e2, white pawn" }).click();
  await page.getByRole("button", { name: "e4, empty" }).click();
  await expect(page.locator(".status")).toContainText("Your move");
  const before = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).game.id,
    stateKey,
  );
  const second = await context.newPage();
  await second.goto("/");
  await expect(second.getByText(/open in another tab/)).toBeVisible();
  await expect(second.getByRole("button", { name: "Play Classic" })).toHaveCount(0);
  await second.getByRole("button", { name: "Take over in this tab" }).click();
  await expect(second.getByRole("button", { name: "Resume game", exact: true })).toBeVisible();
  await expect(page.getByText(/open in another tab/)).toBeVisible();
  await second.getByRole("button", { name: "Resume game", exact: true }).click();
  await expect(second.getByRole("button", { name: "e4, white pawn" })).toBeVisible();
  expect(
    await second.evaluate((key) => JSON.parse(localStorage.getItem(key)!).game.id, stateKey),
  ).toBe(before);
  await second.close();
  await page.getByRole("button", { name: "Take over in this tab" }).click();
  await expect(page.getByRole("button", { name: "Resume game", exact: true })).toBeVisible();
});

test("unavailable locks offer repeatable temporary unrated play without touching damaged data", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "locks", { value: undefined });
    localStorage.setItem("chess-prodigy-state-v9", "damaged-original");
  });
  await page.goto("/");
  await expect(page.getByText(/cannot safely coordinate/)).toBeVisible();
  await page.getByRole("button", { name: "Play temporarily without saving" }).click();
  await expect(page.getByText(/Temporary unrated play/)).toBeVisible();
  for (let index = 0; index < 2; index++) {
    if (index === 0) await enterPlay(page);
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await page.getByRole("button", { name: "e2, white pawn" }).click();
    await page.getByRole("button", { name: "e4, empty" }).click();
    await expect(page.locator(".status")).toContainText("Your move");
    await page.getByRole("button", { name: "Resign", exact: true }).click();
    await page
      .getByRole("dialog", { name: "Resign this game?" })
      .getByRole("button", { name: "Resign" })
      .click();
    const result = page.getByRole("dialog", { name: "Resignation" });
    await expect(result).toBeVisible();
    await expect(result).toContainText("Unrated");
    if (index === 0) await result.getByRole("button", { name: "New game" }).click();
  }
  expect(await page.evaluate((key) => localStorage.getItem(key), stateKey)).toBe(
    "damaged-original",
  );
});

test("corrupt history blocks mutation and exports original bytes before reset", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("chess-prodigy-guest-history-v8", "raw-broken-history"),
  );
  await page.goto("/");
  await expect(page.getByText(/recorded history could not be opened safely/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reset after downloading originals" }),
  ).toBeDisabled();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download original saved data" }).click();
  const stream = await (await download).createReadStream();
  let text = "";
  for await (const chunk of stream!) text += chunk.toString();
  expect(JSON.parse(text).originals["chess-prodigy-guest-history-v8"]).toBe("raw-broken-history");
  expect(await page.evaluate(() => localStorage.getItem("chess-prodigy-guest-history-v8"))).toBe(
    "raw-broken-history",
  );
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Reset after downloading originals" }).click();
  await expect(page.getByRole("main", { name: "Chess Prodigy home" })).toBeVisible();
});

test("blocked browser storage offers isolated temporary play after explicit identity recovery", async ({
  page,
}) => {
  const origin = "http://127.0.0.1:4318";
  const email = `storage-${Date.now()}@example.com`;
  const password = "correct horse battery staple";
  expect(
    (
      await page.request.post(`${origin}/api/auth/sign-up/email`, {
        headers: { Origin: origin },
        data: { name: "Storage", email, password },
      })
    ).ok(),
  ).toBe(true);
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("blocked", "SecurityError");
    };
    Storage.prototype.setItem = () => {
      throw new DOMException("blocked", "SecurityError");
    };
  });
  await page.goto(origin);
  await page.getByRole("button", { name: "End server session and recover sign-in" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page
    .getByRole("dialog", { name: "Sign in", exact: true })
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(page.getByText(/This browser could not save all your changes/)).toBeVisible();
  await page.getByRole("button", { name: "Play temporarily without saving" }).click();
  await expect(page.getByRole("main", { name: "Chess Prodigy home" })).toBeVisible();
  await expect(page.getByText(/Temporary unrated play/)).toBeVisible();
});

test.describe("account ownership", () => {
  test.use({ baseURL: "http://127.0.0.1:4318" });
  test("account outbox waits for ownership and old account cannot write into replacement", async ({
    page,
    context,
  }) => {
    const suffix = Date.now();
    const create = async (name: string) => {
      const response = await context.request.post("http://127.0.0.1:4318/api/auth/sign-up/email", {
        headers: { Origin: "http://127.0.0.1:4318" },
        data: {
          name,
          email: `${name}-${suffix}@example.com`,
          password: "correct horse battery staple",
        },
      });
      expect(response.ok()).toBe(true);
      return (await response.json()).user.id as string;
    };
    const firstId = await create("First");
    await page.goto("/");
    await expect(page.getByText("Saved to account", { exact: true })).toBeVisible();
    const second = await context.newPage();
    await second.goto("/");
    await expect(second.getByText(/open in another tab/)).toBeVisible();
    await second.getByRole("button", { name: "Take over in this tab" }).click();
    await expect(second.getByText("Saved to account", { exact: true })).toBeVisible();
    await expect(page.getByText(/open in another tab/)).toBeVisible();
    await second.getByRole("button", { name: "First", exact: true }).click();
    await second.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(second.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
    const nextId = await create("Second");
    await second.reload();
    await expect(second.getByRole("button", { name: "Second", exact: true })).toBeVisible();
    // This stale tab still targets First; server ownership must reject loading Second's data.
    await page.getByRole("button", { name: "Take over in this tab" }).click();
    await expect(
      page.getByText(/Could not clear this device’s previous account alerts/),
    ).toBeVisible();
    const record = await context.request.get("http://127.0.0.1:4318/api/records", {
      headers: { "X-Chess-Account": nextId },
    });
    expect((await record.json()).snapshot).toBeNull();
    expect(
      await second.evaluate(
        (id) =>
          JSON.parse(localStorage.getItem(`chess-prodigy-account-v9:${id}`)!).snapshot.game.id,
        nextId,
      ),
    ).not.toBe(
      await second.evaluate(
        (id) =>
          JSON.parse(localStorage.getItem(`chess-prodigy-account-v9:${id}`)!).snapshot.game.id,
        firstId,
      ),
    );
  });
});

test("a crashed writer releases the browser lock without a stale final save", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(page.getByRole("main", { name: "Chess Prodigy home" })).toBeVisible();
  const before = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).game.id,
    stateKey,
  );
  const second = await context.newPage();
  await second.goto("/");
  await expect(second.getByText(/open in another tab/)).toBeVisible();
  const debuggerSession = await context.newCDPSession(page);
  const crashed = page.waitForEvent("crash");
  void debuggerSession.send("Page.crash").catch(() => {});
  await crashed;
  await second.getByRole("button", { name: "Take over in this tab" }).click();
  await expect(second.getByRole("main", { name: "Chess Prodigy home" })).toBeVisible();
  expect(
    await second.evaluate((key) => JSON.parse(localStorage.getItem(key)!).game.id, stateKey),
  ).toBe(before);
});
