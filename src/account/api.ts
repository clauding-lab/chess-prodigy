import type { AccountUser, LeaderboardPlayer } from "./types";
import { parseRecordsEnvelope } from "./records";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const timeout = new AbortController();
  let timer = 0;
  const expired = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => {
      timeout.abort();
      reject(new ApiError("The server took too long to respond.", 504));
    }, 8000);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url, {
          credentials: "same-origin",
          ...init,
          signal: timeout.signal,
        });
        let body: { message?: string; error?: string };
        try {
          body = (await response.json()) as { message?: string; error?: string };
        } catch {
          if (response.ok) throw new ApiError("The server returned an invalid response.", 502);
          body = {};
        }
        if (!response.ok)
          throw new ApiError(
            body.message || body.error || "The request could not be completed.",
            response.status,
          );
        return body as T;
      })(),
      expired,
    ]);
  } finally {
    window.clearTimeout(timer);
  }
}

const post = <T>(url: string, body?: unknown) =>
  json<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export async function getAccountSession(): Promise<AccountUser | null> {
  const result = await json<{ user?: AccountUser } | null>("/api/auth/get-session");
  return result?.user ?? null;
}

export async function signUp(name: string, email: string, password: string) {
  await post("/api/auth/sign-up/email", { name: name.trim(), email: email.trim(), password });
  return getAccountSession();
}

export async function signIn(email: string, password: string) {
  await post("/api/auth/sign-in/email", { email: email.trim(), password });
  return getAccountSession();
}

const accountHeaders = (userId: string) => ({ "X-Chess-Account": userId });
export const signOut = (userId: string) =>
  json("/api/auth/sign-out", { method: "POST", headers: accountHeaders(userId) });
export const changeName = (userId: string, name: string) =>
  json("/api/auth/update-user", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...accountHeaders(userId) },
    body: JSON.stringify({ name: name.trim() }),
  });
export const changePassword = (userId: string, currentPassword: string, newPassword: string) =>
  json("/api/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...accountHeaders(userId) },
    body: JSON.stringify({ currentPassword, newPassword, revokeOtherSessions: true }),
  });
export async function getRecords(userId: string) {
  const value = await json<unknown>("/api/records", {
    cache: "no-store",
    headers: accountHeaders(userId),
  });
  const records = parseRecordsEnvelope(value);
  if (!records) throw new ApiError("The server returned invalid account records.", 502);
  return records;
}
export async function getLeaderboard() {
  const result = await json<{ players: LeaderboardPlayer[] }>("/api/leaderboard", {
    cache: "no-store",
  });
  return result.players;
}
