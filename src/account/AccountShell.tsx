import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import App from "../App";
import { acquireWriter, type WriterLease } from "../storage/coordination";
import {
  guestStorage,
  temporaryStorage,
  rawGuestRecovery,
  downloadRecoveryBytes,
} from "../storage/play-storage";
import { loadSavedState, saveState } from "../storage/store";
import { loadGuestHistory, GUEST_HISTORY_KEY } from "../storage/history";
import { freshSession } from "../game/state";
import type { GameStorageAdapter } from "../game/useGame";
import { Modal } from "../ui/Modal";
import { AboutModal } from "../ui/AboutModal";
import { ApiError, getAccountSession, getRecords, signOut } from "./api";
import { AccountModal, AuthModal, LeaderboardModal } from "./AccountModals";
import { AccountRecoveryError, AccountSync, type AccountSyncStatus } from "./sync";
import type { AccountUser, RecordsEnvelope } from "./types";
import { Multiplayer } from "../multiplayer/Multiplayer";
import { HeadToHeadModal, useHeadToHead } from "../multiplayer/HeadToHead";
import { detachDevicePush, reconcileDevicePush } from "../multiplayer/notifications";

type Boot =
  | { kind: "loading" }
  | { kind: "guest"; storage: GameStorageAdapter; mountKey: string }
  | { kind: "blocked"; user: AccountUser | null; waiting?: boolean }
  | { kind: "guest-recovery"; message: string; exported: boolean }
  | { kind: "auth-error"; message: string }
  | { kind: "records-error"; user: AccountUser; message: string }
  | {
      kind: "account";
      user: AccountUser;
      sync: AccountSync;
      initial: ReturnType<typeof freshSession>;
      mountKey: string;
    };

function localStorageSafe() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function invalidateAccountRequest(request: { current: number }) {
  request.current++;
}

export function AccountShell() {
  const [path, setPath] = useState(window.location.pathname);
  const navigate = useCallback((next: string, options?: { replace?: boolean }) => {
    if (options?.replace) window.history.replaceState(null, "", next);
    else window.history.pushState(null, "", next);
    setPath(next);
  }, []);
  useEffect(() => {
    const pop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  const multiplayerOpen =
    path === "/games" || path.startsWith("/invite/") || path.startsWith("/game/");
  const accountRequest = useRef(0);
  const bootActions = useRef<{
    openGuest(): Promise<void>;
    openAccount(user: AccountUser): Promise<void>;
  } | null>(null);
  const writer = useRef<WriterLease | null>(null);
  const writerUser = useRef<AccountUser | null>(null);
  const syncRef = useRef<AccountSync | null>(null);
  const lockWait = useRef<AbortController | null>(null);
  const [boot, setBoot] = useState<Boot>({ kind: "loading" });
  const [authOpen, setAuthOpen] = useState(false);
  const [temporaryError, setTemporaryError] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<AccountSyncStatus | null>(null);
  const [h2hOpenFor, setH2hOpenFor] = useState<string | null>(null);
  const h2hUserId =
    boot.kind === "account" && syncStatus?.state !== "signed-out" ? boot.user.id : null;
  const { history: h2hHistory, refresh: refreshH2h } = useHeadToHead(h2hUserId, path);
  const hasH2h = !!h2hHistory?.opponents.length;

  useEffect(() => {
    let active = true;
    void getAccountSession()
      .then(async (user) => {
        if (!active) return;
        if (!user) {
          try {
            await reconcileDevicePush(null);
          } catch {
            if (active)
              setBoot({
                kind: "auth-error",
                message:
                  "Could not clear this device’s previous account alerts. Reconnect and sign in again.",
              });
            return;
          }
          if (!active) return;
          await bootActions.current!.openGuest();
          return;
        }
        await bootActions.current!.openAccount(user);
      })
      .catch(() => {
        if (active) void bootActions.current!.openGuest();
      });
    return () => {
      active = false;
      invalidateAccountRequest(accountRequest);
      lockWait.current?.abort();
      syncRef.current?.dispose();
      syncRef.current = null;
      writer.current?.release();
      writer.current = null;
    };
  }, []);

  function relinquish(user: AccountUser | null) {
    invalidateAccountRequest(accountRequest);
    syncRef.current?.dispose();
    syncRef.current = null;
    writer.current?.release();
    writer.current = null;
    setBoot({ kind: "blocked", user });
  }

  async function own(user: AccountUser | null, requestId: number, wait = false) {
    setTemporaryError(null);
    const identity = user ? `account:${user.id}` : "guest";
    if (writer.current?.identity === identity && writer.current.active()) return writer.current;
    syncRef.current?.dispose();
    syncRef.current = null;
    writer.current?.release();
    writer.current = null;
    lockWait.current?.abort();
    const controller = new AbortController();
    lockWait.current = controller;
    setBoot(wait ? { kind: "blocked", user, waiting: true } : { kind: "loading" });
    const lease = await acquireWriter(identity, () => relinquish(user), {
      wait,
      signal: controller.signal,
    });
    if (requestId !== accountRequest.current) {
      lease?.release();
      return null;
    }
    if (!lease) {
      setBoot({ kind: "blocked", user });
      return null;
    }
    writer.current = lease;
    writerUser.current = user;
    return lease;
  }

  async function openGuest(wait = false) {
    const requestId = ++accountRequest.current;
    const lease = await own(null, requestId, wait);
    if (!lease) return;
    const storage = localStorageSafe();
    const active = loadSavedState(storage, Date.now(), crypto.randomUUID());
    const history = loadGuestHistory(storage);
    if (
      [active.status, history.status].some(
        (status) => status === "corrupt" || status === "unavailable",
      )
    ) {
      setBoot({
        kind: "guest-recovery",
        exported: false,
        message:
          "Saved game or recorded history could not be opened safely. Your original data is preserved. Download it before explicitly resetting, or start separate temporary play.",
      });
      return;
    }
    setBoot({
      kind: "guest",
      storage: guestStorage(storage, lease),
      mountKey: crypto.randomUUID(),
    });
  }

  async function playTemporary() {
    const requestId = ++accountRequest.current;
    lockWait.current?.abort();
    setBoot((previous) =>
      previous.kind === "blocked" ? { ...previous, waiting: false } : previous,
    );
    setTemporaryError(null);
    try {
      await reconcileDevicePush(null);
    } catch (error) {
      if (requestId === accountRequest.current)
        setTemporaryError(
          error instanceof Error
            ? error.message
            : "Could not disable device alerts. Retry before entering temporary play.",
        );
      return;
    }
    if (requestId !== accountRequest.current) return;
    syncRef.current?.dispose();
    syncRef.current = null;
    writer.current?.release();
    writer.current = null;
    setBoot({ kind: "guest", storage: temporaryStorage(), mountKey: crypto.randomUUID() });
  }

  useEffect(() => {
    const hide = () => {
      lockWait.current?.abort();
      if (writer.current) relinquish(writerUser.current);
      else if (boot.kind === "blocked") {
        invalidateAccountRequest(accountRequest);
        setBoot({ ...boot, waiting: false });
      }
    };
    window.addEventListener("pagehide", hide);
    return () => window.removeEventListener("pagehide", hide);
  }, [boot]);

  async function openAccount(user: AccountUser, wait = false) {
    const requestId = ++accountRequest.current;
    const lease = await own(user, requestId, wait);
    if (!lease) return;
    try {
      await reconcileDevicePush(user.id);
    } catch {
      if (requestId === accountRequest.current)
        setBoot({
          kind: "auth-error",
          message:
            "Could not clear this device’s previous account alerts. Reconnect and sign in again.",
        });
      return;
    }
    if (requestId !== accountRequest.current) return;
    let remote: RecordsEnvelope;
    let offline = false;
    try {
      remote = await getRecords(user.id);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        if (requestId === accountRequest.current)
          setBoot({ kind: "auth-error", message: "Your account session changed. Sign in again." });
        return;
      }
      remote = {
        version: 0,
        snapshot: freshSession(Date.now(), crypto.randomUUID()),
        games: [],
        updatedAt: null,
      };
      offline = true;
    }
    if (requestId !== accountRequest.current) return;
    if (!remote.snapshot)
      remote = { ...remote, snapshot: freshSession(Date.now(), crypto.randomUUID()) };
    const sync = new AccountSync(user.id, localStorageSafe());
    let initial: ReturnType<typeof freshSession>;
    try {
      initial = sync.initialize(remote, !offline);
    } catch (error) {
      sync.dispose();
      if (requestId === accountRequest.current)
        setBoot({
          kind: "records-error",
          user,
          message:
            error instanceof AccountRecoveryError
              ? error.message
              : "Could not safely open your account records. Your saved copies are preserved.",
        });
      return;
    }
    if (offline) sync.markOffline();
    syncRef.current = sync;
    setBoot((previous) => {
      if (previous.kind === "account") previous.sync.dispose();
      return { kind: "account", user, sync, initial, mountKey: crypto.randomUUID() };
    });
    setAuthOpen(false);
  }

  bootActions.current = { openGuest, openAccount };

  const activeSync = boot.kind === "account" ? boot.sync : null;
  useEffect(() => {
    if (!activeSync) {
      setSyncStatus(null);
      return;
    }
    const update = () => setSyncStatus(activeSync.status());
    update();
    const unsubscribe = activeSync.subscribe(update);
    void activeSync.flush();
    const online = () => void activeSync.flush();
    window.addEventListener("online", online);
    return () => {
      unsubscribe();
      window.removeEventListener("online", online);
    };
  }, [activeSync]);

  const accountInitial = boot.kind === "account" ? boot.initial : null;
  const accountId = boot.kind === "account" ? boot.user.id : null;
  const adapter = useMemo<GameStorageAdapter | undefined>(() => {
    if (!activeSync || !accountInitial || !accountId) return undefined;
    let timer: number | undefined;
    let hasChanged = false;
    return {
      scope: "account",
      writable: () =>
        writer.current?.identity === `account:${accountId}` &&
        writer.current.active() &&
        syncRef.current === activeSync,
      history: () => activeSync.history(),
      subscribeHistory: (listener) => activeSync.subscribe(listener),
      refreshHistory: async () => {
        const lease = writer.current;
        const remote = await getRecords(accountId);
        if (lease?.active() && syncRef.current === activeSync) activeSync.acceptHistory(remote);
      },
      load: () => ({
        session: accountInitial,
        status: "saved",
        hasSavedGame: accountInitial.game.started && !accountInitial.game.over,
      }),
      save: (session, options) => {
        if (!writer.current?.active() || syncRef.current !== activeSync) return false;
        if (!hasChanged && JSON.stringify(session) === JSON.stringify(accountInitial)) return true;
        hasChanged = true;
        const saved = activeSync.save(session, options);
        window.clearTimeout(timer);
        if (options?.terminal) void activeSync.flush();
        else timer = window.setTimeout(() => void activeSync.flush(), 1000);
        return saved;
      },
    };
  }, [activeSync, accountInitial, accountId]);

  if (boot.kind === "blocked")
    return (
      <div className="account-loading">
        <div role="alert">
          <p>
            {navigator.locks
              ? "This saved progress is open in another tab, or this tab released it. This tab cannot change it until it owns the save."
              : "This browser cannot safely coordinate saved games. Persistent play is blocked."}
          </p>
          {navigator.locks && (
            <button
              className="btn primary"
              disabled={boot.waiting}
              onClick={() => void (boot.user ? openAccount(boot.user, true) : openGuest(true))}
            >
              {boot.waiting ? "Waiting for the other tab to release…" : "Take over in this tab"}
            </button>
          )}
          {boot.waiting && (
            <p>
              Close the other tab if it cannot respond. Progress will be reloaded after it releases
              the save.
            </p>
          )}
          {temporaryError && <p role="alert">{temporaryError}</p>}
          <button className="btn" onClick={playTemporary}>
            Play temporarily without saving
          </button>
        </div>
      </div>
    );
  if (boot.kind === "guest-recovery")
    return (
      <div className="account-loading">
        <div role="alert">
          <p>{boot.message}</p>
          <button
            className="btn"
            onClick={() => {
              try {
                downloadRecoveryBytes(rawGuestRecovery(localStorageSafe()));
                setBoot({ ...boot, exported: true });
              } catch (error) {
                setBoot({ ...boot, message: String(error) });
              }
            }}
          >
            Download original saved data
          </button>
          <button
            className="btn"
            disabled={!boot.exported}
            onClick={() => {
              if (!writer.current?.active()) return;
              if (
                !window.confirm(
                  "Reset the current saved game and recorded history? Keep your downloaded originals for recovery.",
                )
              )
                return;
              try {
                const storage = localStorageSafe();
                if (!storage) throw Error("Storage is unavailable. Use temporary play.");
                // Older recovery generations remain untouched. Only explicit current authority is reset.
                if (!saveState(storage, freshSession(Date.now(), crypto.randomUUID())))
                  throw Error(
                    "Reset could not be saved. Keep your downloaded originals and use temporary play.",
                  );
                storage.setItem(GUEST_HISTORY_KEY, JSON.stringify({ version: 2, games: [] }));
                void openGuest();
              } catch (error) {
                setBoot({ ...boot, message: String(error) });
              }
            }}
          >
            Reset after downloading originals
          </button>
          {temporaryError && <p role="alert">{temporaryError}</p>}
          <button className="btn" onClick={playTemporary}>
            Play temporarily without saving
          </button>
        </div>
      </div>
    );
  if (boot.kind === "loading")
    return (
      <div className="account-loading" role="status">
        Opening Chess Prodigy…
      </div>
    );
  if (boot.kind === "auth-error")
    return (
      <div className="account-loading">
        <div className="account-auth-error" role="alert">
          <p>{boot.message}</p>
          <button className="btn primary" onClick={() => setAuthOpen(true)}>
            Sign in again
          </button>
        </div>
        {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onAuthenticated={openAccount} />}
      </div>
    );
  if (boot.kind === "records-error")
    return (
      <div className="account-loading">
        <div className="account-auth-error" role="alert">
          <p>{boot.message}</p>
          <button className="btn primary" onClick={() => void openAccount(boot.user)}>
            Retry account download
          </button>
        </div>
      </div>
    );
  const account = boot.kind === "account" ? boot : null;
  const controls = (
    <div className="account-bar">
      <button className="linkbtn" onClick={() => setLeaderboardOpen(true)}>
        Leaderboard
      </button>
      {hasH2h && (
        <button
          className="linkbtn"
          onClick={() => {
            setH2hOpenFor(h2hUserId);
            refreshH2h();
          }}
        >
          H2H
        </button>
      )}
      <button className="linkbtn" onClick={() => navigate("/games")}>
        Play a friend
      </button>
      <button
        className="linkbtn"
        onClick={() =>
          account && syncStatus?.state !== "signed-out" ? setAccountOpen(true) : setAuthOpen(true)
        }
      >
        {syncStatus?.state === "signed-out"
          ? "Sign in again"
          : account
            ? account.user.name
            : "Sign in"}
      </button>
      <button className="linkbtn" onClick={() => setAboutOpen(true)}>
        About
      </button>
      {account && syncStatus && (
        <span className="cloud-status" role="status">
          {syncStatus.state === "syncing"
            ? "Saving…"
            : syncStatus.state === "idle" && syncStatus.pending === 0
              ? "Saved to account"
              : "Pending changes"}
        </span>
      )}
    </div>
  );
  const conflict = account && syncStatus?.state === "conflict";
  return (
    <>
      {temporaryError && (
        <div className="notice" role="alert">
          {temporaryError}
        </div>
      )}
      <App
        key={
          account
            ? `${account.user.id}:${account.mountKey}`
            : boot.kind === "guest"
              ? boot.mountKey
              : "guest"
        }
        storage={boot.kind === "guest" ? boot.storage : adapter}
        onTemporary={playTemporary}
        suspended={multiplayerOpen}
        accountControls={controls}
        accountNotice={
          account && (syncStatus?.state === "offline" || syncStatus?.state === "error") ? (
            <>
              {syncStatus.state === "error"
                ? "Sync paused. Keep this tab open, then retry. "
                : "Account sync is unavailable. Keep this tab open, then retry. "}
              <button className="linkbtn" onClick={() => void account.sync.flush()}>
                Retry sync
              </button>
            </>
          ) : account &&
            (syncStatus?.state === "rejected" || syncStatus?.state === "storage-error") ? (
            <>
              {syncStatus.state === "storage-error"
                ? "This browser could not save all your changes. Newer progress may exist only in this tab. Keep it open and download a private recovery copy now. "
                : "The server rejected this save. Automatic retries have stopped; your queued games are preserved on this device. Download a private recovery copy before changing browsers or clearing storage. "}
              <button
                className="linkbtn"
                type="button"
                onClick={() => {
                  const url = URL.createObjectURL(
                    new Blob([account.sync.exportRecovery()], { type: "application/json" }),
                  );
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "chess-prodigy-account-recovery.json";
                  link.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
              >
                Download recovery copy
              </button>
              {syncStatus.canCompactRetry && (
                <button
                  className="linkbtn"
                  onClick={() => {
                    if (account.sync.retryCompactRejected()) void account.sync.flush();
                  }}
                >
                  Retry compact save
                </button>
              )}
            </>
          ) : syncStatus?.state === "upgrade-required" ? (
            "Sync paused: update Chess Prodigy to use this account's newer save format. Your pending changes are preserved."
          ) : syncStatus?.state === "signed-out" ? (
            <>
              Your session ended.{" "}
              <button className="linkbtn" onClick={() => setAuthOpen(true)}>
                Sign in again
              </button>{" "}
              to sync saved account changes.
            </>
          ) : null
        }
      />
      {multiplayerOpen && (
        <Multiplayer
          key={account?.user.id ?? "guest"}
          user={account?.user ?? null}
          path={path}
          navigate={navigate}
          controls={controls}
          onSignIn={() => setAuthOpen(true)}
          onCompletedGame={refreshH2h}
        />
      )}
      {authOpen && (
        <AuthModal
          onClose={() => setAuthOpen(false)}
          onAuthenticated={(user) => void openAccount(user)}
        />
      )}
      {accountOpen && account && (
        <AccountModal
          user={account.user}
          onNameChanged={(name) =>
            setBoot((previous) =>
              previous.kind === "account" && previous.user.id === account.user.id
                ? { ...previous, user: { ...previous.user, name } }
                : previous,
            )
          }
          onClose={() => setAccountOpen(false)}
          onSignOut={async () => {
            await detachDevicePush(account.user.id);
            await signOut(account.user.id);
            invalidateAccountRequest(accountRequest);
            account.sync.dispose();
            setAccountOpen(false);
            await openGuest();
          }}
        />
      )}
      {leaderboardOpen && <LeaderboardModal onClose={() => setLeaderboardOpen(false)} />}
      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
      {hasH2h && h2hHistory && h2hOpenFor === h2hUserId && (
        <HeadToHeadModal
          history={h2hHistory}
          onClose={() => setH2hOpenFor(null)}
          onRetry={refreshH2h}
        />
      )}
      {conflict && (
        <Modal
          title="Progress changed on another device"
          closeOnBackdrop={false}
          closeOnEscape={false}
          className="conflict-modal"
        >
          <p>Choose which copy to keep.</p>
          <div className="modal-actions">
            <button
              className="btn"
              onClick={() => {
                const session = account.sync.useCloud();
                if (session)
                  setBoot({ ...account, initial: session, mountKey: crypto.randomUUID() });
              }}
            >
              Use cloud copy
            </button>
            <button
              className="btn primary"
              onClick={() => {
                account.sync.keepDevice();
                void account.sync.flush();
              }}
            >
              Keep this device
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
