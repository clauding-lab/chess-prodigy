import { useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
export function UpdatePrompt({
  active,
  save,
  offlineMessage = "Ready to play offline on this device.",
}: {
  active: boolean;
  save: () => boolean;
  offlineMessage?: string;
}) {
  const [error, setError] = useState("");
  const {
    needRefresh: [needsUpdate, setNeedsUpdate],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: () =>
      setError("Offline setup could not finish. Reopen the app while connected to try again."),
  });
  async function update() {
    if (!save()) {
      setError("Could not save your game. The update has been postponed.");
      return;
    }
    try {
      await updateServiceWorker(true);
    } catch {
      setError("The update could not finish. Please try again when connected.");
    }
  }
  return (
    <>
      {error && (
        <p role="alert" className="note">
          {error}
        </p>
      )}
      {needsUpdate && (
        <aside className="panel" aria-label="App update">
          <p>
            {active
              ? "An update is ready. It will wait until your game finishes."
              : "A new version of Chess Prodigy is ready."}
          </p>
          {!active && (
            <button className="btn" onClick={() => void update()}>
              Update now
            </button>
          )}
          <button className="btn" onClick={() => setNeedsUpdate(false)}>
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
