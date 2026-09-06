import { randomUUID } from "node:crypto";
import type { ChatState, ChatMessage } from "../src/multiplayer/chat-types.js";

interface Peer {
  userId: string;
  seen: number;
  typingUntil: number;
}
interface Room {
  epoch: string;
  peers: Map<string, Peer>;
  messages: ChatMessage[];
}
export class ChatError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Volatile only: never writes chat text to a database, file, or log. */
export class EphemeralChat {
  private rooms = new Map<string, Room>();
  private closed = new Map<string, number>();
  private revision = 0;
  private timer: ReturnType<typeof setInterval>;
  constructor(private now = Date.now) {
    this.timer = setInterval(() => this.sweep(), 1000);
    this.timer.unref();
  }
  close() {
    clearInterval(this.timer);
    this.rooms.clear();
    this.closed.clear();
  }
  private reset(room: Room) {
    room.messages = [];
    room.epoch = randomUUID();
    for (const peer of room.peers.values()) peer.typingUntil = 0;
  }
  private tombstone(key: string) {
    this.closed.set(key, this.now() + 120_000);
    if (this.closed.size > 10_000) this.closed.delete(this.closed.keys().next().value!);
  }
  private sweep() {
    const now = this.now();
    for (const [key, until] of this.closed) if (until <= now) this.closed.delete(key);
    for (const [gameId, room] of this.rooms) {
      for (const [key, peer] of room.peers) {
        // Allow time for the one-second sweep and the recipient's two-second poll.
        if (now - peer.seen >= 25_000) {
          room.peers.delete(key);
          this.tombstone(`${gameId}:${key}`);
          this.reset(room);
        }
      }
      if (!room.peers.size) this.rooms.delete(gameId);
    }
  }
  request(gameId: string, userId: string, input: unknown): ChatState {
    this.sweep();
    if (!input || typeof input !== "object") throw new ChatError(400, "Invalid chat request.");
    const body = input as Record<string, unknown>;
    const { action, clientId } = body;
    if (
      typeof clientId !== "string" ||
      !/^[A-Za-z0-9-]{12,80}$/.test(clientId) ||
      !["join", "poll", "send", "typing", "leave"].includes(String(action))
    )
      throw new ChatError(400, "Invalid chat request.");
    const key = `${userId}:${clientId}`;
    const closedKey = `${gameId}:${key}`;
    let room = this.rooms.get(gameId);
    if (action === "leave") {
      this.tombstone(closedKey);
      if (room?.peers.delete(key)) this.reset(room);
      if (room && !room.peers.size) this.rooms.delete(gameId);
      return { epoch: "", revision: ++this.revision, messages: [], typing: false };
    }
    if (this.closed.has(closedKey))
      throw new ChatError(409, "Chat session ended. Reopen the match to chat.");
    if (action === "join") {
      if (!room) {
        if (this.rooms.size >= 1000) throw new ChatError(429, "Chat is busy. Try again shortly.");
        room = { epoch: randomUUID(), peers: new Map(), messages: [] };
        this.rooms.set(gameId, room);
      }
      if (!room.peers.has(key) && room.peers.size >= 8)
        throw new ChatError(429, "Close another match tab before opening chat.");
      room.peers.set(key, { userId, seen: this.now(), typingUntil: 0 });
    }
    const peer = room?.peers.get(key);
    if (!room || !peer) throw new ChatError(409, "Chat session ended. Reopen the match to chat.");
    peer.seen = this.now();
    if (action === "send" || action === "typing") {
      if (body.epoch !== room.epoch)
        throw new ChatError(409, "Chat was cleared because a player left. Try again.");
      if (action === "send") {
        if (typeof body.text !== "string" || !body.text.trim() || body.text.length > 1000)
          throw new ChatError(400, "Write a message of up to 1,000 characters.");
        room.messages.push({ id: randomUUID(), userId, text: body.text.trim() });
        room.messages = room.messages.slice(-100);
        peer.typingUntil = 0;
      } else {
        if (typeof body.typing !== "boolean") throw new ChatError(400, "Invalid typing status.");
        peer.typingUntil = body.typing ? this.now() + 4000 : 0;
      }
    }
    return {
      epoch: room.epoch,
      revision: ++this.revision,
      messages: [...room.messages],
      typing: [...room.peers.values()].some(
        (p) => p.userId !== userId && p.typingUntil > this.now(),
      ),
    };
  }
}
