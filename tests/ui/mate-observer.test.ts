import { afterEach, expect, it } from "vitest";
import { observeInjectedMate } from "../browser/mate-observer";

afterEach(() => document.body.replaceChildren());

it.each([false, true])(
  "detects a same-task mate label restored before observer delivery (removed=%s)",
  async (removed) => {
    document.body.innerHTML = '<div class="evalbar" aria-label="Equal position"></div>';
    observeInjectedMate();
    const bar = document.querySelector(".evalbar")!;
    bar.setAttribute("aria-label", "White mates in 1");
    bar.setAttribute("aria-label", "Equal position");
    if (removed) bar.remove();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(Reflect.get(window, "__acceptedInjectedMate")).toBe(true);
  },
);

it("ignores ordinary evaluation updates", async () => {
  document.body.innerHTML = '<div class="evalbar" aria-label="Equal position"></div>';
  observeInjectedMate();
  document.querySelector(".evalbar")!.setAttribute("aria-label", "White +0.3");
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  expect(Reflect.get(window, "__acceptedInjectedMate")).toBe(false);
});
