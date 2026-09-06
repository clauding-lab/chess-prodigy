import { json } from "../account/api";
import type { MultiplayerGame, MultiplayerList, InviteColor, DrawAction } from "./types";
import type { Move } from "../engine/types";
export function multiplayerRequest<T>(userId: string, path: string, body?: unknown): Promise<T> {
  return json<T>(`/api/multiplayer${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "X-Chess-Account": userId, "Content-Type": "application/json" },
    cache: "no-store",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
export const listGames = (userId: string) => multiplayerRequest<MultiplayerList>(userId, "");
export const readGame = (userId: string, id: string) =>
  multiplayerRequest<MultiplayerGame>(userId, `/${encodeURIComponent(id)}`);
export const createInvite = (userId: string, color: InviteColor) =>
  multiplayerRequest<{ id: string; token: string }>(userId, "/invites", { color });
export const joinInvite = (userId: string, token: string) =>
  multiplayerRequest<MultiplayerGame>(userId, "/join", { token });
export const actOnGame = (
  userId: string,
  game: MultiplayerGame,
  action: "move" | "resign" | "draw" | "cancel",
  detail: { move?: Move; action?: DrawAction } = {},
) =>
  multiplayerRequest<MultiplayerGame>(userId, `/${encodeURIComponent(game.id)}/${action}`, {
    expectedRevision: game.revision,
    ...detail,
  });
