import { useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { prepareAppUpdate, registerUpdateView, soleAppClient } from "./update-gate";
export function UpdatePrompt({
  active,
  save,
  ready,
  offlineMessage = "Ready to play offline on this device.",
}: {
  active: boolean;
  save: () => boolean;
  ready?: () => Promise<boolean>;
  offlineMessage?: string;
}) {
  const [error, setError] = useState("");
  const [deferred, setDeferred] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reloadAvailable, setReloadAvailable] = useState(false);
  const requested = useRef(false);
  const mounted = useRef(false);
  const current = useRef({ active, save, ready });
  current.current = { active, save, ready };
  useEffect(() => {
    mounted.current = true;
    const remove = registerUpdateView(() => current.current);
    return () => {
      mounted.current = false;
      requested.current = false;
      remove();
    };
  }, []);
  const {
    needRefresh: [needsUpdate],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onNeedReload: () => {
      if (!mounted.current) return;
      setReloadAvailable(true);
      // Another tab activating a worker must never reload this tab.
      if (requested.current) {
        requested.current = false;
        void prepareAppUpdate(async () => true)
          .then(() => {
            if (mounted.current) window.location.reload();
          })
          .catch(
            (reason: unknown) =>
              mounted.current &&
              setError(reason instanceof Error ? reason.message : "The update has been postponed."),
          );
      }
    },
    onRegisterError: () =>
      setError("Offline setup could not finish. Reopen the app while connected to try again."),
  });
  async function update() {
    setBusy(true);
    setError("");
    try {
      await prepareAppUpdate(reloadAvailable ? async () => true : soleAppClient);
      if (!mounted.current) return;
      if (reloadAvailable) window.location.reload();
      else {
        requested.current = true;
        await updateServiceWorker(true);
      }
    } catch (reason) {
      requested.current = false;
      if (mounted.current)
        setError(
          reason instanceof Error
            ? reason.message
            : "The update could not finish. Please try again when connected.",
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <>
      {error && (
        <p role="alert" className="note">
          {error}
        </p>
      )}
      {(needsUpdate || reloadAvailable) && deferred && !active && (
        <button className="linkbtn" onClick={() => setDeferred(false)}>
          Update available
        </button>
      )}
      {(needsUpdate || reloadAvailable) && !deferred && (
        <aside className="panel" aria-label="App update">
          <p>
            {active
              ? "An update is ready. It will wait until your game finishes."
              : "A new version of Chess Prodigy is ready."}
          </p>
          {!active && (
            <button className="btn" disabled={busy} onClick={() => void update()}>
              Update now
            </button>
          )}
          <button className="btn" onClick={() => setDeferred(true)}>
            Later
          </button>
        </aside>
      )}
      {offlineReady && !needsUpdate && (
        <aside className="panel" aria-label="Offline ready">
          <p>{offlineMessage}</p>
          <button className="btn" onClick={() => setOfflineReady(false)}>
            Got it
          </button>
        </aside>
      )}
    </>
  );
}
