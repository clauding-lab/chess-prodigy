import { act, fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Chat } from "../../src/multiplayer/Chat";
import type { ChatState } from "../../src/multiplayer/chat-types";

let state: ChatState;
vi.mock("../../src/multiplayer/api", () => ({
  multiplayerRequest: async () => structuredClone(state),
}));
let intersect: (entries: Partial<IntersectionObserverEntry>[]) => void;
let target: HTMLDivElement;
beforeEach(() => {
  vi.useFakeTimers();
  state = { epoch: "room-a", revision: 0, messages: [], typing: false };
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: typeof intersect) {
        intersect = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("fetch", async () => new Response());
  target = document.createElement("div");
  document.body.appendChild(target);
});
afterEach(() => {
  cleanup();
  target.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function mount() {
  await act(async () => {
    render(<Chat userId="me" gameId="game-a" alertTarget={target} />);
  });
}
async function poll() {
  state.revision++;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
}
function incoming(id: string) {
  state.messages.push({ id, userId: "opponent", text: `Message ${id}` });
}
const unread = () => screen.queryByRole("button", { name: "Chat, unread messages", exact: true });

it("alerts for offscreen incoming messages, ignores own messages and clears when read", async () => {
  await mount();
  state.messages.push({ id: "own", userId: "me", text: "Hello" });
  await poll();
  expect(unread()).toBeNull();
  incoming("1");
  await poll();
  expect(unread()).not.toBeNull();
  act(() => intersect([{ isIntersecting: true, intersectionRatio: 1 }]));
  expect(unread()).toBeNull();
  incoming("2");
  await poll();
  expect(unread()).toBeNull();
  act(() => intersect([{ isIntersecting: false, intersectionRatio: 0 }]));
  await poll();
  expect(unread()).toBeNull();
  incoming("3");
  await poll();
  expect(unread()).not.toBeNull();
});

it("clears the unread alert when the room is erased", async () => {
  await mount();
  incoming("1");
  await poll();
  expect(unread()).not.toBeNull();
  state = { epoch: "room-b", revision: 2, messages: [], typing: false };
  await poll();
  expect(unread()).toBeNull();
  expect(screen.queryByText("Message 1")).toBeNull();
});

it("keeps background messages unread until the visible chat returns to the foreground", async () => {
  await mount();
  act(() => intersect([{ isIntersecting: true, intersectionRatio: 1 }]));
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  incoming("1");
  await poll();
  expect(unread()).not.toBeNull();
  visibility.mockReturnValue("visible");
  fireEvent(document, new Event("visibilitychange"));
  expect(unread()).toBeNull();
  visibility.mockRestore();
});
