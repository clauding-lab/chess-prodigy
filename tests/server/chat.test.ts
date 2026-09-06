// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { EphemeralChat } from "../../server/chat";

const stores: EphemeralChat[] = [];
afterEach(() => {
  stores.splice(0).forEach((store) => store.close());
  vi.useRealTimers();
});
function fixture() {
  vi.useFakeTimers();
  const chat = new EphemeralChat();
  stores.push(chat);
  const a = { clientId: "alice-session-123", action: "join" };
  const b = { clientId: "bob-session-12345", action: "join" };
  const { epoch } = chat.request("game", "a", a);
  chat.request("game", "b", b);
  return { chat, a, b, epoch };
}

it("expires typing and clears messages after either participant stops heartbeats", () => {
  const { chat, a, b, epoch } = fixture();
  chat.request("game", "a", { ...a, action: "send", epoch, text: "Hello 👋" });
  chat.request("game", "a", { ...a, action: "typing", epoch, typing: true });
  expect(chat.request("game", "b", { ...b, action: "poll" }).typing).toBe(true);
  vi.advanceTimersByTime(4000);
  expect(chat.request("game", "b", { ...b, action: "poll" }).typing).toBe(false);
  vi.advanceTimersByTime(16000);
  chat.request("game", "b", { ...b, action: "poll" });
  vi.advanceTimersByTime(11000);
  const state = chat.request("game", "b", { ...b, action: "poll" });
  expect(state.messages).toEqual([]);
  expect(state.epoch).not.toBe(epoch);
  expect(() => chat.request("game", "a", { ...a, action: "poll" })).toThrow(/ended/);
});

it("does not let a delayed leave from an older tab erase a newer chat", () => {
  const { chat, a, b } = fixture();
  chat.request("game", "a", { ...a, action: "leave" });
  const newer = { ...a, clientId: "alice-session-456" };
  const { epoch } = chat.request("game", "a", newer);
  chat.request("game", "a", { ...newer, action: "send", epoch, text: "New session" });
  chat.request("game", "a", { ...a, action: "leave" });
  expect(chat.request("game", "b", { ...b, action: "poll" }).messages[0].text).toBe("New session");
});

it("leaves cleanup margin even when presence arrives between timer ticks", () => {
  const { chat, a, b, epoch } = fixture();
  vi.advanceTimersByTime(750);
  chat.request("game", "a", { ...a, action: "send", epoch, text: "Between ticks" });
  vi.advanceTimersByTime(20000);
  chat.request("game", "b", { ...b, action: "poll" });
  vi.advanceTimersByTime(6000);
  expect(chat.request("game", "b", { ...b, action: "poll" }).messages).toEqual([]);
});

it("cannot restore a transcript after closing the store or starting a new server", () => {
  const { chat, a, epoch } = fixture();
  chat.request("game", "a", { ...a, action: "send", epoch, text: "Temporary" });
  chat.close();
  const fresh = new EphemeralChat();
  stores.push(fresh);
  expect(fresh.request("game", "a", a).messages).toEqual([]);
});
