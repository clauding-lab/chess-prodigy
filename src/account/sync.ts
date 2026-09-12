import type { Session } from "../game/types";
import { parseSavedState } from "../storage/schema";
import type { GameRecord, RecordsEnvelope } from "./types";
import { parseRecordsEnvelope } from "./records";
import { overlayArchive } from "../game/archive";
import { parseHistory, type HistoryResult } from "../storage/history";

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type SyncState =
  | "idle"
  | "syncing"
  | "offline"
  | "conflict"
  | "signed-out"
  | "storage-error"
  | "error"
  | "upgrade-required";
interface PendingItem {
  snapshot: Session;
  terminal: boolean;
}
interface PersistedSync {
  baseVersion: number;
  pending: PendingItem[];
  snapshot: Session;
  history?: unknown;
}
interface Conflict {
  current: RecordsEnvelope;
}

export interface AccountSyncStatus {
  state: SyncState;
  pending: number;
  conflict: RecordsEnvelope | null;
}

export const accountStorageKey = (userId: string) =>
  `chess-prodigy-account-v4:${encodeURIComponent(userId)}`;
export const measuredAccountStorageKey = (userId: string) =>
  `chess-prodigy-account-v3:${encodeURIComponent(userId)}`;
export const betaAccountStorageKey = (userId: string) =>
  `chess-prodigy-account-v2:${encodeURIComponent(userId)}`;
export const previousAccountStorageKey = (userId: string) =>
  `chess-prodigy-account-v1:${encodeURIComponent(userId)}`;

function validPersisted(value: unknown): PersistedSync | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<PersistedSync>;
  if (!Number.isSafeInteger(candidate.baseVersion) || Number(candidate.baseVersion) < 0)
    return null;
  const snapshot = parseSavedState(candidate.snapshot);
  if (!snapshot || !Array.isArray(candidate.pending)) return null;
  const pending: PendingItem[] = [];
  for (const item of candidate.pending) {
    if (!item || typeof item !== "object") return null;
    const entry = item as Partial<PendingItem>;
    const snapshot = parseSavedState(entry.snapshot);
    if (!snapshot || typeof entry.terminal !== "boolean") return null;
    pending.push({ snapshot, terminal: entry.terminal });
  }
  return {
    baseVersion: Number(candidate.baseVersion),
    snapshot,
    pending,
    history: candidate.history,
  };
}

export class AccountSync {
  private baseVersion = 0;
  private pending: PendingItem[] = [];
  private snapshot: Session | null = null;
  private syncState: SyncState = "idle";
  private conflict: Conflict | null = null;
  private running: Promise<void> | null = null;
  private listeners = new Set<() => void>();
  private disposed = false;
  private storageBlocked = false;
  private remoteGames: GameRecord[] = [];
  private historyReady = false;
  private historyServerVersion = 0;
  private corruptHistory: unknown = undefined;
  private readonly abort = new AbortController();

  constructor(
    private readonly userId: string,
    private readonly storage: Storage | null,
    private readonly request: Fetch = fetch,
  ) {}

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  initialize(remote: RecordsEnvelope, remoteAvailable = true): Session {
    const local = this.readLocal();
    const cached = parseHistory(local?.history);
    if (local?.history !== undefined && !cached) this.corruptHistory = local.history;
    this.remoteGames = remoteAvailable ? remote.games : (cached ?? []);
    this.historyReady = remoteAvailable || cached !== null;
    const cacheVersion =
      local?.history && typeof local.history === "object" && "serverVersion" in local.history
        ? local.history.serverVersion
        : undefined;
    this.historyServerVersion = remoteAvailable
      ? remote.version
      : Number.isSafeInteger(cacheVersion) && Number(cacheVersion) >= 0
        ? Number(cacheVersion)
        : (local?.baseVersion ?? 0);
    if (local && (local.pending.length > 0 || !remoteAvailable)) {
      this.baseVersion = local.baseVersion;
      this.pending = local.pending;
      this.snapshot = local.snapshot;
      this.persistLocal();
    } else {
      this.baseVersion = remote.version;
      this.pending = [];
      this.snapshot = remote.snapshot;
      if (this.snapshot) this.persistLocal();
    }
    if (!this.snapshot) throw new Error("Account sync requires an initial session.");
    return this.snapshot;
  }

  save(snapshot: Session, options: { terminal?: boolean } = {}) {
    const normalized = parseSavedState(snapshot);
    if (this.disposed || !normalized) return false;
    snapshot = normalized;
    const terminal = options.terminal === true;
    this.snapshot = snapshot;
    const last = this.pending.at(-1);
    if (!terminal && last && !last.terminal && last.snapshot.game.id === snapshot.game.id)
      this.pending[this.pending.length - 1] = { snapshot, terminal: false };
    else this.pending.push({ snapshot, terminal });
    const stored = this.persistLocal();
    this.emit();
    return stored;
  }

  flush(): Promise<void> {
    if (this.running) return this.running;
    if (this.disposed || !this.pending.length || this.conflict) return Promise.resolve();
    // Never send migrated or changed outboxes until the new key is durable.
    if (!this.persistLocal()) {
      this.emit();
      return Promise.resolve();
    }
    this.running = this.drain().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async drain() {
    this.syncState = "syncing";
    this.emit();
    while (!this.disposed && this.pending.length && !this.conflict) {
      const sent = this.pending[0];
      let response: Response;
      const timeout = new AbortController();
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const expired = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          timeout.abort();
          reject(new Error("Account sync timed out."));
        }, 8000);
      });
      try {
        const request = this.request;
        response = await Promise.race([
          request("/api/records", {
            method: "PUT",
            credentials: "same-origin",
            headers: {
              "Content-Type": "application/json",
              "X-Chess-Account": this.userId,
              "X-Chess-Rating-Policy": "2",
            },
            signal: AbortSignal.any([this.abort.signal, timeout.signal]),
            body: JSON.stringify({ expectedVersion: this.baseVersion, snapshot: sent.snapshot }),
          }),
          expired,
        ]);
      } catch {
        clearTimeout(timeoutId);
        this.syncState = "offline";
        this.emit();
        return;
      }
      if (response.status === 401) {
        clearTimeout(timeoutId);
        this.syncState = "signed-out";
        this.emit();
        return;
      }
      if (response.status === 409) {
        let body: unknown;
        try {
          body = await Promise.race([response.json(), expired]);
        } catch {
          clearTimeout(timeoutId);
          this.syncState = "error";
          this.emit();
          return;
        }
        clearTimeout(timeoutId);
        const current =
          body && typeof body === "object" && "current" in body
            ? parseRecordsEnvelope((body as { current: unknown }).current)
            : null;
        if (!current) {
          this.syncState = "error";
          this.emit();
          return;
        }
        this.conflict = { current };
        this.syncState = "conflict";
        this.emit();
        return;
      }
      if (!response.ok) {
        clearTimeout(timeoutId);
        this.syncState =
          response.status === 426
            ? "upgrade-required"
            : response.status === 400
              ? "error"
              : "offline";
        this.emit();
        return;
      }
      let body: unknown;
      try {
        body = await Promise.race([response.json(), expired]);
      } catch {
        clearTimeout(timeoutId);
        this.syncState = "error";
        this.emit();
        return;
      }
      clearTimeout(timeoutId);
      const accepted = parseRecordsEnvelope(body);
      if (
        !accepted ||
        accepted.version !== this.baseVersion + 1 ||
        !accepted.snapshot ||
        JSON.stringify(accepted.snapshot) !== JSON.stringify(sent.snapshot)
      ) {
        this.syncState = "error";
        this.emit();
        return;
      }
      if (this.pending[0] === sent) this.pending.shift();
      this.baseVersion = accepted.version;
      this.adoptHistory(accepted);
      if (!this.persistLocal()) {
        this.emit();
        return;
      }
    }
    if (!this.disposed) {
      this.syncState = this.storageBlocked ? "storage-error" : "idle";
      this.emit();
    }
  }

  useCloud() {
    const remote = this.conflict?.current;
    if (!remote?.snapshot) return null;
    this.baseVersion = remote.version;
    this.adoptHistory(remote);
    this.pending = [];
    this.snapshot = remote.snapshot;
    this.conflict = null;
    this.syncState = "idle";
    this.persistLocal();
    this.emit();
    return remote.snapshot;
  }

  keepDevice() {
    const remote = this.conflict?.current;
    if (!remote || !this.snapshot) return;
    this.baseVersion = remote.version;
    this.adoptHistory(remote);
    this.conflict = null;
    this.syncState = "idle";
    this.persistLocal();
    this.emit();
  }

  status(): AccountSyncStatus {
    return {
      state: this.syncState,
      pending: this.pending.length,
      conflict: this.conflict?.current ?? null,
    };
  }

  private adoptHistory(remote: RecordsEnvelope) {
    if (remote.version < this.historyServerVersion) return;
    this.remoteGames = remote.games;
    this.historyServerVersion = remote.version;
    this.historyReady = true;
  }

  acceptHistory(remote: RecordsEnvelope) {
    if (this.disposed || remote.version < this.historyServerVersion) return;
    this.adoptHistory(remote);
    this.persistLocal();
    this.emit();
  }

  history(): HistoryResult {
    return {
      games: overlayArchive(
        this.remoteGames,
        this.pending.map((item) => item.snapshot),
      ),
      status:
        this.corruptHistory !== undefined ? "corrupt" : this.historyReady ? "ready" : "incomplete",
      pending: this.pending.length > 0,
      ...(this.corruptHistory !== undefined ? { raw: JSON.stringify(this.corruptHistory) } : {}),
    };
  }

  markOffline() {
    this.syncState = "offline";
  }

  dispose() {
    this.disposed = true;
    this.abort.abort();
    this.listeners.clear();
  }

  private readLocal() {
    if (!this.storage) return null;
    try {
      const raw =
        this.storage.getItem(accountStorageKey(this.userId)) ??
        this.storage.getItem(measuredAccountStorageKey(this.userId)) ??
        this.storage.getItem(betaAccountStorageKey(this.userId)) ??
        this.storage.getItem(previousAccountStorageKey(this.userId));
      if (raw === null) return null;
      const parsed = validPersisted(JSON.parse(raw));
      if (!parsed) {
        this.storageBlocked = true;
        this.syncState = "storage-error";
      }
      return parsed;
    } catch {
      this.storageBlocked = true;
      this.syncState = "storage-error";
      return null;
    }
  }

  private persistLocal() {
    if (!this.storage || !this.snapshot || this.storageBlocked) {
      this.syncState = "storage-error";
      return false;
    }
    try {
      this.storage.setItem(
        accountStorageKey(this.userId),
        JSON.stringify({
          baseVersion: this.baseVersion,
          pending: this.pending,
          snapshot: this.snapshot,
          ...(this.corruptHistory !== undefined
            ? { history: this.corruptHistory }
            : this.historyReady
              ? {
                  history: {
                    version: 1,
                    serverVersion: this.historyServerVersion,
                    games: this.remoteGames,
                  },
                }
              : {}),
        } satisfies PersistedSync),
      );
      return true;
    } catch {
      this.syncState = "storage-error";
      return false;
    }
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }
}
