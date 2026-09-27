import { getAccountSession, json, signOut } from "../account/api";
export interface NotificationConfig {
  emailEnabled: boolean;
  pushPublicKey: string | null;
}
export async function notificationRequest<T>(
  userId: string,
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  return json<T>(`/api/notifications/${path}`, {
    method,
    headers: { "x-chess-account": userId, ...(body ? { "content-type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
const ownerKey = "chess-push-owner";
function storedPushOwner(): string | null {
  try {
    return localStorage.getItem(ownerKey);
  } catch {
    return null;
  }
}
function clearPushOwner(): void {
  try {
    localStorage.removeItem(ownerKey);
  } catch {
    // A cancelled browser subscription is sufficient; an unreadable marker is never trusted.
  }
}
const generationKey = "chess-push-generation";
const staleMessage =
  "The account or device alerts changed in another tab. Reopen this account before changing alerts.";
const unreadableGeneration = Symbol("unreadable push generation");
function generation(): string | null | typeof unreadableGeneration {
  try {
    return localStorage.getItem(generationKey);
  } catch {
    return unreadableGeneration;
  }
}
async function mutatePush<T>(
  expected: string | null,
  operation: () => Promise<T>,
  allowExpired = false,
  captured = generation(),
  intent: "enable" | "end-session" | "open-account" = "end-session",
): Promise<T> {
  if (!navigator.locks) throw new Error("This browser cannot safely coordinate device alerts.");
  return navigator.locks.request("chess-prodigy:push", { mode: "exclusive" }, async () => {
    if (generation() !== captured) throw new Error(staleMessage);
    let session;
    let sessionVerified = false;
    try {
      session = await getAccountSession();
      sessionVerified = true;
    } catch (error) {
      // Offline sign-out may cancel only the subscription still owned by this account.
      const sub = await (
        await navigator.serviceWorker.getRegistration()
      )?.pushManager?.getSubscription();
      if (sub && (!allowExpired || storedPushOwner() !== expected)) throw error;
      if (!allowExpired && expected !== null) throw error;
      session = null;
    }
    if ((session?.id ?? null) !== expected && !(allowExpired && session === null))
      throw new Error(staleMessage);
    if (generation() !== captured) throw new Error(staleMessage);
    // Opening/retaining the authenticated account is not an identity transition.
    // Fresh session identity already rejects another account’s pending permission.
    if (intent === "open-account") return operation();
    // Enabling needs a durable generation. If cancellation cannot advance it, a
    // verified server logout under this same lock blocks old permission work.
    let generationAdvanced = false;
    try {
      localStorage.setItem(generationKey, crypto.randomUUID());
      generationAdvanced = true;
    } catch (error) {
      if (intent === "enable") throw error;
    }
    const result = await operation();
    if (!generationAdvanced) {
      const logoutUser = session?.id ?? expected;
      if (logoutUser) await signOut(logoutUser);
      else if (!sessionVerified)
        throw new Error("Reconnect to safely end device alerts before switching accounts.");
    }
    return result;
  });
}
export async function reconcileDevicePush(
  userId: string | null,
  expectedSessionId = userId,
): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (
    !navigator.locks &&
    !(await (await navigator.serviceWorker.getRegistration())?.pushManager?.getSubscription())
  )
    return;
  await mutatePush(
    expectedSessionId,
    async () => {
      const sw = await navigator.serviceWorker.getRegistration();
      const sub = await sw?.pushManager?.getSubscription();
      if (!sub) {
        clearPushOwner();
        return;
      }
      if (userId !== null && storedPushOwner() === userId) return;
      if (!(await sub.unsubscribe()))
        throw new Error(
          "Could not disable the previous account’s device alerts. Reconnect and retry before continuing.",
        );
      clearPushOwner();
    },
    false,
    generation(),
    userId === null ? "end-session" : "open-account",
  );
}
export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}
async function registration() {
  const existing = await navigator.serviceWorker.getRegistration();
  if (!existing)
    throw new Error("Reopen the installed app after it finishes loading, then try again.");
  return existing;
}
export async function devicePushEnabled(userId: string) {
  if (!pushSupported()) return false;
  const sub = await (
    await navigator.serviceWorker.getRegistration()
  )?.pushManager.getSubscription();
  return Boolean(sub && storedPushOwner() === userId);
}
export async function detachDevicePush(userId: string): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (
    !navigator.locks &&
    !(await (await navigator.serviceWorker.getRegistration())?.pushManager?.getSubscription())
  )
    return;
  await mutatePush(
    userId,
    async () => {
      // A stale tab must never cancel a subscription owned by a different account.
      const owner = storedPushOwner();
      if (owner !== null && owner !== userId) throw new Error(staleMessage);
      const sub = await (
        await navigator.serviceWorker.getRegistration()
      )?.pushManager?.getSubscription();
      if (!sub) {
        clearPushOwner();
        return;
      }
      try {
        await notificationRequest(userId, "push", "DELETE", { endpoint: sub.endpoint });
      } catch {
        // Browser cancellation is still mandatory, even if server deletion succeeded.
      }
      if (!(await sub.unsubscribe()))
        throw new Error("Could not disable device alerts. Reconnect before signing out.");
      clearPushOwner();
    },
    true,
  );
}
export async function enableDevicePush(userId: string, key: string) {
  if (!pushSupported()) throw new Error("This browser does not support device notifications.");
  const captured = generation();
  if (captured === unreadableGeneration)
    throw new Error(
      "Device alert ownership storage is unavailable. Restore storage before enabling alerts.",
    );
  // Request permission directly from the click; recheck identity after permission resolves.
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error(
      "Notification permission was not granted. You can change it in browser settings.",
    );
  await mutatePush(
    userId,
    async () => {
      const sw = await registration();
      let sub = await sw.pushManager.getSubscription();
      if (sub && storedPushOwner() !== userId) {
        if (!(await sub.unsubscribe())) throw new Error("Could not detach the previous account.");
        sub = null;
      }
      if (!sub) {
        const bytes = Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
          c.charCodeAt(0),
        );
        sub = await sw.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: bytes,
        });
      }
      try {
        await notificationRequest(userId, "push", "POST", sub.toJSON());
        localStorage.setItem(ownerKey, userId);
      } catch (error) {
        if (!(await sub.unsubscribe()))
          throw new Error("Could not disable device alerts. Reconnect before switching accounts.");
        clearPushOwner();
        throw error;
      }
    },
    false,
    captured,
    "enable",
  );
}
