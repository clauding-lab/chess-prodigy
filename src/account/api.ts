import type { AccountUser, LeaderboardPlayer } from "./types";
import { parseRecordsEnvelope } from "./records";
import { reportSessionExpiry } from "./session-expiry";

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
        if (response.status === 401) {
          const accountId = new Headers(init?.headers).get("x-chess-account");
          if (accountId) reportSessionExpiry(accountId);
        }
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

const signOutIntentKey = "chess-account-sign-out-intent";
export function retainSignOutIntent(userId: string): void {
  localStorage.setItem(
    signOutIntentKey,
    JSON.stringify({ userId, generation: crypto.randomUUID() }),
  );
  recoveredUnavailableIntent = false;
}
export class SignOutRecoveryError extends Error {
  constructor() {
    super(
      "Sign-out recovery is needed. End the current server session explicitly, then sign in again. Your private saved games remain unchanged.",
    );
  }
}
let recoveredUnavailableIntent = false;
function readSignOutIntent(): { raw: string; userId: string; generation: string } | null {
  try {
    const raw = localStorage.getItem(signOutIntentKey);
    if (raw === null) return null;
    if (raw.length > 2048) throw new SignOutRecoveryError();
    const value: unknown = JSON.parse(raw);
    if (
      !value ||
      typeof value !== "object" ||
      !("userId" in value) ||
      !("generation" in value) ||
      typeof value.userId !== "string" ||
      !value.userId.length ||
      value.userId.length > 512 ||
      typeof value.generation !== "string" ||
      !value.generation.length ||
      value.generation.length > 128
    )
      throw new SignOutRecoveryError();
    return { raw, userId: value.userId, generation: value.generation };
  } catch {
    if (recoveredUnavailableIntent) return null;
    throw new SignOutRecoveryError();
  }
}
// Explicit recovery for an invalid/unreadable marker. Never delete or overwrite it.
// A verified server logout makes fresh authentication safe for this page lifetime.
export async function recoverSignOutIntent(): Promise<void> {
  const result = await json<{ user?: AccountUser } | null>("/api/auth/get-session");
  if (result?.user) await signOut(result.user.id);
  recoveredUnavailableIntent = true;
}
export async function getAccountSession(): Promise<AccountUser | null> {
  const result = await json<{ user?: AccountUser } | null>("/api/auth/get-session");
  const intent = readSignOutIntent();
  if (!intent) return result?.user ?? null;
  if (result?.user?.id === intent.userId) await signOut(intent.userId);
  // A later account must never be signed out by an earlier account's retained intent.
  try {
    if (localStorage.getItem(signOutIntentKey) === intent.raw)
      localStorage.removeItem(signOutIntentKey);
  } catch {
    /* Session identity has been reconciled; preserve an unavailable marker. */
  }
  return result?.user?.id === intent.userId ? null : (result?.user ?? null);
}

export async function signUp(name: string, email: string, password: string) {
  if (readSignOutIntent()) await getAccountSession();
  await post("/api/auth/sign-up/email", { name: name.trim(), email: email.trim(), password });
  return getAccountSession();
}

export async function signIn(email: string, password: string) {
  if (readSignOutIntent()) await getAccountSession();
  await post("/api/auth/sign-in/email", { email: email.trim(), password });
  return getAccountSession();
}

const accountHeaders = (userId: string) => ({ "X-Chess-Account": userId });
export async function signOut(userId: string): Promise<void> {
  try {
    await json("/api/auth/sign-out", { method: "POST", headers: accountHeaders(userId) });
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401)) throw error;
  }
}
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
