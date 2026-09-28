import { expect, test, type Page } from "@playwright/test";
import { enterPlay } from "./enter-play";
import { parseSessionInput } from "../../src/storage/input";
import { accountStorageKey } from "../../src/account/sync";
import { sqName } from "../../src/engine/board";

test.use({ baseURL: "http://127.0.0.1:4318" });
const enabled =
  process.env.VITE_ENGINE_EXPERIMENT === "true" && process.env.VITE_PERSONALITY_BETA === "true";
async function cloud(page: Page) {
  return page.evaluate(async () => {
    const auth = await fetch("/api/auth/get-session").then((r) => r.json());
    const response = await fetch("/api/records", { headers: { "X-Chess-Account": auth.user.id } });
    if (!response.ok) throw new Error(`Account read failed: ${response.status}`);
    return response.json();
  });
}
test("experimental account progress restores in a fresh browser without importing guest data", async ({
  page,
  browser,
}, info) => {
  test.skip(!enabled, "Experimental setup is intentionally default-off.");
  const suffix = `${info.project.name}-${Date.now()}`;
  const email = `experiment-${suffix}@example.com`,
    password = "correct horse battery staple";
  await page.goto("/");
  await enterPlay(page);
  await page
    .getByRole("dialog", { name: "New game", exact: true })
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await page.getByLabel("Display name").fill(`Experiment ${suffix}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(
    page.getByRole("button", { name: `Experiment ${suffix}`, exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Play Bobby Fischer", exact: true }).click();
  const setup = page.getByRole("dialog", { name: "New game", exact: true });
  await expect(setup).toContainText("Experimental opponent — unrated");
  await setup.getByRole("button", { name: "No clock", exact: true }).click();
  await setup.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "e2, white pawn", exact: true }).click();
  await page.getByRole("button", { name: "e4, empty", exact: true }).click();
  await expect
    .poll(async () => parseSessionInput((await cloud(page)).snapshot)?.game.hist.length)
    .toBe(2);
  const original = parseSessionInput((await cloud(page)).snapshot)!;
  expect(original.game.opponent).toMatchObject({
    id: "fischer",
    version: 2,
    engine: "fischer-coherent-v1",
  });
  expect(original.game.rated).toBe(false);
  const other = await browser.newContext();
  try {
    const second = await other.newPage();
    await second.goto("http://127.0.0.1:4318/");
    await enterPlay(second);
    await second
      .getByRole("dialog", { name: "New game", exact: true })
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await second.getByLabel("Email").fill(email);
    await second.getByLabel("Password").fill(password);
    await second
      .getByRole("dialog", { name: "Sign in", exact: true })
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await expect(second.getByRole("button", { name: "Resume game", exact: true })).toBeVisible();
    await second.getByRole("button", { name: "Resume game", exact: true }).click();
    await expect(second.locator(".status")).toContainText("Your move");
    const restored = parseSessionInput((await cloud(second)).snapshot)!;
    expect(restored.game.id).toBe(original.game.id);
    expect(restored.game.st).toEqual(original.game.st);
    expect(restored.game.opponent).toEqual(original.game.opponent);
    expect(restored.rating).toEqual(original.rating);
    const userId = await second.evaluate(
      async () => (await fetch("/api/auth/get-session").then((r) => r.json())).user.id,
    );
    const local = await second.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).snapshot,
      accountStorageKey(userId),
    );
    expect(parseSessionInput(local)?.game.st).toEqual(original.game.st);
    expect(parseSessionInput(local)?.game.hist).toEqual(original.game.hist);
    const names: Record<string, string> = {
      p: "pawn",
      n: "knight",
      b: "bishop",
      r: "rook",
      q: "queen",
      k: "king",
    };
    for (let square = 0; square < 64; square++) {
      const piece = original.game.st.board[square];
      const label = piece ? `${piece[0] === "w" ? "white" : "black"} ${names[piece[1]]}` : "empty";
      await expect(
        second.getByRole("button", { name: `${sqName(square)}, ${label}`, exact: true }),
      ).toBeVisible();
    }
  } finally {
    await other.close();
  }
});
