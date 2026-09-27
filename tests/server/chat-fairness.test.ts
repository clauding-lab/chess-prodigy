// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import { EphemeralChat } from "../../server/chat";
const chats: EphemeralChat[] = [];
afterEach(() => {
  for (const chat of chats.splice(0)) chat.close();
});
function fixture() {
  let now = 1000;
  const chat = new EphemeralChat(() => now);
  chats.push(chat);
  return {
    chat,
    advance: () => {
      now += 25000;
    },
  };
}
const peer = (id: number) => ({ action: "join", clientId: `session-client-${id}` });
it("reserves four peers for each participant instead of a shared monopolizable limit", () => {
  const { chat } = fixture();
  for (let i = 0; i < 4; i++) chat.request("game", "a", peer(i));
  expect(() => chat.request("game", "a", peer(4))).toThrow(/tab/);
  for (let i = 0; i < 4; i++) expect(chat.request("game", "b", peer(i)).messages).toEqual([]);
  expect(() => chat.request("game", "b", peer(4))).toThrow(/tab/);
  expect(chat.request("game", "a", peer(0)).messages).toEqual([]);
});
it("caps each account at ten rooms and frees capacity on leave or expiry", () => {
  const { chat, advance } = fixture();
  for (let i = 0; i < 10; i++) chat.request(`game-${i}`, "a", peer(i));
  expect(() => chat.request("extra", "a", peer(11))).toThrow(/match/);
  expect(chat.request("unrelated", "b", peer(11)).messages).toEqual([]);
  // Joining an existing room must also obey the account room cap.
  expect(() => chat.request("unrelated", "a", peer(11))).toThrow(/match/);
  chat.request("game-0", "a", { ...peer(0), action: "leave" });
  expect(chat.request("extra", "a", peer(11)).messages).toEqual([]);
  advance();
  expect(chat.request("fresh", "a", peer(12)).messages).toEqual([]);
  expect(() => chat.request("game-1", "a", peer(1))).toThrow(/ended/);
});
