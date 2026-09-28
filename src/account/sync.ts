import { readStorageRevision } from "../storage/revision";
import type { Session, LegacySession } from "../game/types";
import { parseSavedState } from "../storage/schema";
import { parseSessionInput } from "../storage/input";
import { encodeCompactSession, type CompactSession } from "../storage/compact";
import type { GameRecord, RecordsEnvelope } from "./types";
import { parseRecordsEnvelope, parseArchiveEviction } from "./records";
import {
  updateRecoverableArchive,
  type ArchiveEviction,
  type RecoverableArchive,
} from "../game/archive-recovery";
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
  | "rejected"
  | "upgrade-required";
type WireSession = Session | LegacySession | CompactSession;
interface PendingItem {
  wireSnapshot?: WireSession;
  snapshot: Session;
  terminal: boolean;
  attempted?: boolean;
  rejected?: 400 | 413;
  originalRejected?: WireSession;
}
interface PersistedSync {
  storageRevision?: number;
  baseVersion: number;
  pending: Array<Omit<PendingItem, "snapshot" | "wireSnapshot"> & { snapshot: WireSession }>;
  snapshot: WireSession;
  history?: unknown;
}
interface Conflict {
  current: RecordsEnvelope;
}

export interface AccountSyncStatus {
  state: SyncState;
  pending: number;
  conflict: RecordsEnvelope | null;
  canCompactRetry?: boolean;
}

export const accountStorageKey = (userId: string) =>
  `chess-prodigy-account-v9:${encodeURIComponent(userId)}`;
export const repairAccountStorageKey = (userId: string) =>
  `chess-prodigy-account-v8:${encodeURIComponent(userId)}`;
export const rosterAccountStorageKey = (userId: string) =>
  `chess-prodigy-account-v7:${encodeURIComponent(userId)}`;
export const chigorinAccountStorageKey = (userId: string) =>
  `chess-prodigy-account-v6:${encodeURIComponent(userId)}`;
export const plannedAccountStorageKey = (userId: string) =>
  `chess-prodigy-account-v5:${encodeURIComponent(userId)}`;
export const historicalAccountStorageKey = (userId: string) =>
  `chess-prodigy-account-v4:${encodeURIComponent(userId)}`;
export const measuredAccountStorageKey = (userId: string) =>
  `chess-prodigy-account-v3:${encodeURIComponent(userId)}`;
export const betaAccountStorageKey = (userId: string) =>
  `chess-prodigy-account-v2:${encodeURIComponent(userId)}`;
export const previousAccountStorageKey = (userId: string) =>
  `chess-prodigy-account-v1:${encodeURIComponent(userId)}`;

function validPersisted(
  value: unknown,
):
  | (Omit<PersistedSync, "pending" | "snapshot"> & { pending: PendingItem[]; snapshot: Session })
  | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<PersistedSync>;
  if (!Number.isSafeInteger(candidate.baseVersion) || Number(candidate.baseVersion) < 0)
    return null;
  const snapshot = parseSessionInput(candidate.snapshot);
  if (!snapshot || !Array.isArray(candidate.pending)) return null;
  const pending: PendingItem[] = [];
  for (const item of candidate.pending) {
    if (!item || typeof item !== "object") return null;
    const entry = item;
    const snapshot = parseSessionInput(entry.snapshot);
    if (
      !snapshot ||
      typeof entry.terminal !== "boolean" ||
      (entry.attempted !== undefined && typeof entry.attempted !== "boolean") ||
      (entry.rejected !== undefined && entry.rejected !== 400 && entry.rejected !== 413) ||
      (entry.originalRejected !== undefined && !parseSessionInput(entry.originalRejected))
    )
      return null;
    pending.push({
      snapshot,
      wireSnapshot: entry.snapshot,
      terminal: entry.terminal,
      // Old outboxes may predate attempted markers. Conservatively preserve
      // each restored wire until its acknowledgement rather than coalescing it.
      attempted: true,
      ...(entry.rejected ? { rejected: entry.rejected } : {}),
      ...(entry.originalRejected ? { originalRejected: entry.originalRejected } : {}),
    });
  }
  return {
    baseVersion: Number(candidate.baseVersion),
    snapshot,
    pending,
    history: candidate.history,
  };
}

export class AccountRecoveryError extends Error {}

export class AccountSync {
  private initialized = false;
  private storageRevision = 0;
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
  private remoteEvicted: ArchiveEviction | undefined;
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

  private expiredSession = false;

  sessionExpired(): void {
    if (this.disposed || this.expiredSession) return;
    this.expiredSession = true;
    this.abort.abort();
    this.syncState = "signed-out";
    this.emit();
  }

  initialize(remote: RecordsEnvelope, remoteAvailable = true): Session {
    if (this.disposed) throw new AccountRecoveryError("This account writer has been closed.");
    this.initialized = false;
    const local = this.readLocal();
    if (!remoteAvailable && !local)
      throw new AccountRecoveryError(
        "Account records are unavailable. Retry the download before playing.",
      );
    if (remoteAvailable && local && !local.pending.length && remote.version < local.baseVersion)
      throw new AccountRecoveryError(
        "The server returned an older account version. Your device copy is preserved.",
      );
    const cached = parseHistory(local?.history);
    if (local?.history !== undefined && !cached) this.corruptHistory = local.history;
    this.remoteGames = remoteAvailable ? remote.games : (cached ?? []);
    const cachedEvicted =
      cached && local?.history && typeof local.history === "object" && "evicted" in local.history
        ? parseArchiveEviction(local.history.evicted)
        : null;
    this.remoteEvicted = remoteAvailable ? remote.evicted : (cachedEvicted ?? undefined);
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
    this.initialized = true;
    if (this.pending[0]?.rejected && this.syncState !== "storage-error")
      this.syncState = "rejected";
    return this.snapshot;
  }

  save(snapshot: Session, options: { terminal?: boolean } = {}) {
    const normalized = parseSavedState(snapshot);
    if (this.disposed || !this.initialized || !normalized) return false;
    snapshot = normalized;
    const terminal = options.terminal === true;
    this.snapshot = snapshot;
    const last = this.pending.at(-1);
    if (
      !terminal &&
      last &&
      !last.terminal &&
      !last.attempted &&
      !last.originalRejected &&
      last.snapshot.game.id === snapshot.game.id
    )
      this.pending[this.pending.length - 1] = {
        snapshot,
        wireSnapshot: encodeCompactSession(snapshot),
        terminal: false,
      };
    else this.pending.push({ snapshot, wireSnapshot: encodeCompactSession(snapshot), terminal });
    const stored = this.persistLocal();
    this.emit();
    return stored;
  }

  flush(): Promise<void> {
    if (this.disposed || !this.initialized) return Promise.resolve();
    if (this.expiredSession || this.syncState === "signed-out") return Promise.resolve();
    if (this.running) return this.running;
    if (this.pending[0]?.rejected) {
      if (this.persistLocal()) this.syncState = "rejected";
      this.emit();
      return Promise.resolve();
    }
    if (!this.pending.length || this.conflict) return Promise.resolve();
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

  async flushBounded(milliseconds = 2500): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.flush(),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, milliseconds);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
    return (
      !this.disposed &&
      this.initialized &&
      this.status().state === "idle" &&
      this.pending.length === 0
    );
  }

  retainForSignOut(): boolean {
    const retained = this.persistLocal();
    if (!retained) this.emit();
    return retained;
  }

  private async drain() {
    this.syncState = "syncing";
    this.emit();
    while (!this.disposed && !this.expiredSession && this.pending.length && !this.conflict) {
      const sent = this.pending[0];
      // An attempted write may already be committed remotely even if its reply is lost.
      // Keep that exact item durable until acknowledged; later edits cannot coalesce it.
      sent.attempted = true;
      if (!this.persistLocal()) {
        this.emit();
        return;
      }
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
              "X-Chess-Rating-Policy": "7",
            },
            signal: AbortSignal.any([this.abort.signal, timeout.signal]),
            body: JSON.stringify({
              expectedVersion: this.baseVersion,
              snapshot: sent.wireSnapshot ?? sent.snapshot,
            }),
          }),
          expired,
        ]);
      } catch {
        clearTimeout(timeoutId);
        if (this.disposed || this.expiredSession) return;
        this.syncState = "offline";
        this.emit();
        return;
      }
      if (this.disposed || this.expiredSession) {
        clearTimeout(timeoutId);
        return;
      }
      if (response.status === 401) {
        clearTimeout(timeoutId);
        this.sessionExpired();
        return;
      }
      if (response.status === 409) {
        let body: unknown;
        try {
          body = await Promise.race([response.json(), expired]);
        } catch {
          clearTimeout(timeoutId);
          if (this.disposed || this.expiredSession) return;
          this.syncState = "error";
          this.emit();
          return;
        }
        clearTimeout(timeoutId);
        if (this.disposed || this.expiredSession) return;
        const current =
          body && typeof body === "object" && "current" in body
            ? parseRecordsEnvelope((body as { current: unknown }).current)
            : null;
        if (!current) {
          this.syncState = "error";
          this.emit();
          return;
        }
        if (current.version < this.baseVersion) {
          this.syncState = "error";
          this.emit();
          return;
        }
        const rawCurrent = (body as { current: { snapshot: unknown } }).current;
        if (
          current.version === this.baseVersion + 1 &&
          JSON.stringify(rawCurrent.snapshot) === JSON.stringify(sent.wireSnapshot ?? sent.snapshot)
        ) {
          if (this.pending[0] === sent) this.pending.shift();
          this.baseVersion = current.version;
          this.adoptHistory(current);
          if (!this.persistLocal()) {
            this.emit();
            return;
          }
          continue;
        }
        this.conflict = { current };
        this.syncState = "conflict";
        this.emit();
        return;
      }
      if (!response.ok) {
        clearTimeout(timeoutId);
        if (response.status === 400 || response.status === 413) {
          sent.rejected = response.status;
          this.syncState = "rejected";
          this.persistLocal();
          this.emit();
          return;
        }
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
        if (this.disposed || this.expiredSession) return;
        this.syncState = "error";
        this.emit();
        return;
      }
      clearTimeout(timeoutId);
      if (this.disposed || this.expiredSession) return;
      const accepted = parseRecordsEnvelope(body);
      if (
        !accepted ||
        accepted.version !== this.baseVersion + 1 ||
        !accepted.snapshot ||
        JSON.stringify((body as { snapshot: unknown }).snapshot) !==
          JSON.stringify(sent.wireSnapshot ?? sent.snapshot)
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
    if (!this.disposed && !this.expiredSession) {
      this.syncState = this.storageBlocked ? "storage-error" : "idle";
      this.emit();
    }
  }

  useCloud() {
    if (this.disposed || this.expiredSession) return;
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
    if (this.disposed || this.expiredSession) return;
    const remote = this.conflict?.current;
    if (!remote || !this.snapshot) return;
    this.baseVersion = remote.version;
    this.adoptHistory(remote);
    this.conflict = null;
    this.syncState = "idle";
    this.persistLocal();
    this.emit();
  }

  retryCompactRejected(): boolean {
    if (this.disposed || !this.initialized || !this.status().canCompactRetry) return false;
    const item = this.pending[0];
    const original = item.wireSnapshot ?? item.snapshot;
    item.originalRejected ??= original;
    item.wireSnapshot = encodeCompactSession(item.snapshot);
    delete item.rejected;
    delete item.attempted;
    this.syncState = "idle";
    const stored = this.persistLocal();
    this.emit();
    return stored;
  }

  status(): AccountSyncStatus {
    return {
      state: this.expiredSession ? "signed-out" : this.syncState,
      pending: this.pending.length,
      conflict: this.conflict?.current ?? null,
      canCompactRetry:
        !!this.pending[0]?.rejected &&
        (this.pending[0].wireSnapshot ?? this.pending[0].snapshot).version !== 3,
    };
  }

  private adoptHistory(remote: RecordsEnvelope) {
    if (remote.version < this.historyServerVersion) return;
    this.remoteGames = remote.games;
    this.remoteEvicted = remote.evicted;
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
      ...this.pending.reduce<RecoverableArchive>(
        (state, item) => updateRecoverableArchive(state, item.snapshot),
        { games: this.remoteGames, ...(this.remoteEvicted ? { evicted: this.remoteEvicted } : {}) },
      ),
      status:
        this.corruptHistory !== undefined ? "corrupt" : this.historyReady ? "ready" : "incomplete",
      pending: this.pending.length > 0,
      ...(this.corruptHistory !== undefined ? { raw: JSON.stringify(this.corruptHistory) } : {}),
    };
  }

  markOffline() {
    if (!this.pending[0]?.rejected) this.syncState = "offline";
  }

  exportRecovery(): string {
    return JSON.stringify(
      {
        baseVersion: this.baseVersion,
        snapshot: this.snapshot,
        pending: this.pending.map(({ wireSnapshot, ...item }) => ({
          ...item,
          snapshot: wireSnapshot ?? item.snapshot,
        })),
        history: this.corruptHistory ?? {
          version: 2,
          games: this.remoteGames,
          ...(this.remoteEvicted ? { evicted: this.remoteEvicted } : {}),
        },
      },
      null,
      2,
    );
  }

  dispose() {
    this.disposed = true;
    this.abort.abort();
    this.listeners.clear();
  }

  private readLocal() {
    if (!this.storage) return null;
    try {
      const revision = readStorageRevision(this.storage.getItem(accountStorageKey(this.userId)));
      if (revision === null) {
        this.storageBlocked = true;
        this.syncState = "storage-error";
        return null;
      }
      this.storageRevision = revision;
      const raw =
        this.storage.getItem(accountStorageKey(this.userId)) ??
        this.storage.getItem(repairAccountStorageKey(this.userId)) ??
        this.storage.getItem(rosterAccountStorageKey(this.userId)) ??
        this.storage.getItem(chigorinAccountStorageKey(this.userId)) ??
        this.storage.getItem(plannedAccountStorageKey(this.userId)) ??
        this.storage.getItem(historicalAccountStorageKey(this.userId)) ??
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
    if (this.disposed) return false;
    if (!this.storage || !this.snapshot || this.storageBlocked) {
      this.syncState = "storage-error";
      return false;
    }
    try {
      const currentRevision = readStorageRevision(
        this.storage.getItem(accountStorageKey(this.userId)),
      );
      if (
        currentRevision !== this.storageRevision ||
        this.storageRevision >= Number.MAX_SAFE_INTEGER
      ) {
        this.storageBlocked = true;
        this.syncState = "storage-error";
        return false;
      }
      const nextRevision = this.storageRevision + 1;
      this.storage.setItem(
        accountStorageKey(this.userId),
        JSON.stringify({
          storageRevision: nextRevision,
          baseVersion: this.baseVersion,
          pending: this.pending.map(({ wireSnapshot, ...item }) => ({
            ...item,
            snapshot: wireSnapshot ?? item.snapshot,
          })),
          snapshot: encodeCompactSession(this.snapshot),
          ...(this.corruptHistory !== undefined
            ? { history: this.corruptHistory }
            : this.historyReady
              ? {
                  history: {
                    version: 2,
                    ...(this.remoteEvicted ? { evicted: this.remoteEvicted } : {}),
                    serverVersion: this.historyServerVersion,
                    games: this.remoteGames,
                  },
                }
              : {}),
        } satisfies PersistedSync),
      );
      this.storageRevision = nextRevision;
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
