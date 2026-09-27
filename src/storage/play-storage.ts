import type { GameStorageAdapter } from "../game/useGame";
import { freshSession } from "../game/state";
import { loadSavedState, SAVE_KEY, type StorageLike } from "./store";
import { loadGuestHistory, saveGuestProgress } from "./history";
import { readStorageRevision } from "./revision";
import type { WriterLease } from "./coordination";

export function guestStorage(storage: StorageLike | null, lease: WriterLease): GameStorageAdapter {
  let revision: number | undefined;
  return {
    scope: "guest",
    writable: lease.active,
    load(now, id) {
      const result = loadSavedState(storage, now, id);
      revision = result.storageRevision;
      return result;
    },
    history: () => loadGuestHistory(storage),
    save(session) {
      if (!lease.active() || !storage) return false;
      try {
        const before = readStorageRevision(storage.getItem(SAVE_KEY));
        if (before === null || (revision !== undefined && before !== revision)) return false;
        const saved = saveGuestProgress(storage, session, { expectedRevision: before });
        // The active write can succeed while the separate archive write fails.
        // This synchronous interval is protected by the exclusive browser lease.
        revision = readStorageRevision(storage.getItem(SAVE_KEY)) ?? revision;
        return saved;
      } catch {
        return false;
      }
    },
  };
}

/** Memory only: never reads or writes persistent guest/account data. */
export function temporaryStorage(): GameStorageAdapter {
  return {
    scope: "guest",
    temporary: true,
    load: (now, id) => ({ session: freshSession(now, id), status: "unsaved", hasSavedGame: false }),
    save: () => true,
    history: () => ({ games: [], status: "ready" }),
  };
}

export function downloadRecoveryBytes(value: string) {
  const url = URL.createObjectURL(new Blob([value], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "chess-prodigy-original-storage-recovery.json";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function rawGuestRecovery(storage: Storage | null): string {
  if (!storage)
    throw Error("Browser storage cannot be read. Keep this browser's existing data intact.");
  const originals: Record<string, string> = {};
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (
      key &&
      /^(chess-prodigy-state-v\d+|chess-prodigy-guest-history-v\d+|chess-fide-rating-v1)$/.test(key)
    ) {
      const raw = storage.getItem(key);
      if (raw !== null) originals[key] = raw;
    }
  }
  return JSON.stringify({ originals }, null, 2);
}
