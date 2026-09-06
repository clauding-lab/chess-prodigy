import { json } from "../account/api";
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
export async function reconcileDevicePush(userId: string | null): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    clearPushOwner();
    return;
  }
  const message =
    "Could not disable the previous account’s device alerts. Reconnect and retry before continuing.";
  try {
    const sw = await navigator.serviceWorker.getRegistration();
    const sub = await sw?.pushManager?.getSubscription();
    if (!sub) {
      clearPushOwner();
      return;
    }
    if (userId !== null && storedPushOwner() === userId) return;
    if (!(await sub.unsubscribe())) throw new Error(message);
    clearPushOwner();
  } catch {
    throw new Error(message);
  }
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
  if (!pushSupported()) return;
  const sub = await (
    await navigator.serviceWorker.getRegistration()
  )?.pushManager.getSubscription();
  if (!sub) {
    clearPushOwner();
    return;
  }
  let detached = false;
  try {
    await notificationRequest(userId, "push", "DELETE", { endpoint: sub.endpoint });
    detached = true;
  } catch {
    /* Browser cancellation below also prevents delivery to this device. */
  }
  const unsubscribed = await sub.unsubscribe();
  if (!detached && !unsubscribed)
    throw new Error("Could not disable device alerts. Reconnect before signing out.");
  clearPushOwner();
}
export async function enableDevicePush(userId: string, key: string) {
  if (!pushSupported()) throw new Error("This browser does not support device notifications.");
  // Must run directly from the explicit click before any asynchronous work.
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error(
      "Notification permission was not granted. You can change it in browser settings.",
    );
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
    sub = await sw.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
  }
  try {
    await notificationRequest(userId, "push", "POST", sub.toJSON());
    localStorage.setItem(ownerKey, userId);
  } catch (error) {
    await sub.unsubscribe();
    throw error;
  }
}
