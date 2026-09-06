import { useEffect, useState } from "react";
import {
  notificationRequest,
  type NotificationConfig,
  pushSupported,
  devicePushEnabled,
  enableDevicePush,
  detachDevicePush,
} from "./notifications";
export function NotificationSettings({ userId }: { userId: string }) {
  const [config, setConfig] = useState<NotificationConfig | null>(null),
    [email, setEmail] = useState(true),
    [push, setPush] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setConfig(null);
    setError("");
    Promise.all([
      notificationRequest<NotificationConfig>(userId, "config"),
      notificationRequest<{ email: boolean }>(userId, "preferences"),
      devicePushEnabled(userId),
    ])
      .then(([c, p, d]) => {
        if (active) {
          setConfig(c);
          setEmail(p.email);
          setPush(d);
        }
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : "Could not load notifications.");
      });
    return () => {
      active = false;
    };
  }, [userId]);
  async function change(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update notifications.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <fieldset disabled={busy} className="notification-settings">
      <legend>Game notifications</legend>
      {error && <p role="alert">{error}</p>}
      {config && (
        <>
          <label>
            <input
              type="checkbox"
              checked={email}
              onChange={(e) => {
                const value = e.target.checked;
                void change(async () => {
                  await notificationRequest(userId, "preferences", "PUT", { email: value });
                  setEmail(value);
                });
              }}
            />{" "}
            Email me when an opponent joins and once after a turn waits ten minutes
          </label>
          {!config.emailEnabled && (
            <p>Email delivery is not configured yet. Your preference will be saved.</p>
          )}
          {pushSupported() ? (
            <button
              type="button"
              disabled={!config.pushPublicKey && !push}
              onClick={() =>
                void change(async () => {
                  if (push) {
                    await detachDevicePush(userId);
                    setPush(false);
                  } else if (config.pushPublicKey) {
                    await enableDevicePush(userId, config.pushPublicKey);
                    setPush(true);
                  }
                })
              }
            >
              {push
                ? "Disable notifications on this device"
                : "Enable notifications on this device"}
            </button>
          ) : (
            <p>
              Device notifications are unavailable in this browser. On iPhone or iPad, add Chess
              Prodigy to your Home Screen using Share, then open it there.
            </p>
          )}
          {pushSupported() && !config.pushPublicKey && (
            <p>Device notification delivery is not configured yet.</p>
          )}
          <p>
            Email addresses are unverified login IDs. Notifications do not verify your email or
            enable password recovery.
          </p>
        </>
      )}
    </fieldset>
  );
}
