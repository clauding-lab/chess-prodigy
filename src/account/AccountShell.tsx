import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import App from "../App";
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
  | { kind: "guest" }
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
  const [boot, setBoot] = useState<Boot>({ kind: "loading" });
  const [authOpen, setAuthOpen] = useState(false);
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
          setBoot({ kind: "guest" });
          return;
        }
        await openAccount(user);
      })
      .catch(() => {
        if (active) setBoot({ kind: "guest" });
      });
    return () => {
      active = false;
      invalidateAccountRequest(accountRequest);
    };
  }, []);

  async function openAccount(user: AccountUser) {
    const requestId = ++accountRequest.current;
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
    setBoot((previous) => {
      if (previous.kind === "account") previous.sync.dispose();
      return { kind: "account", user, sync, initial, mountKey: crypto.randomUUID() };
    });
    setAuthOpen(false);
  }

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
      history: () => activeSync.history(),
      subscribeHistory: (listener) => activeSync.subscribe(listener),
      refreshHistory: async () => activeSync.acceptHistory(await getRecords(accountId)),
      load: () => ({
        session: accountInitial,
        status: "saved",
        hasSavedGame: accountInitial.game.started && !accountInitial.game.over,
      }),
      save: (session, options) => {
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
      <App
        key={account ? `${account.user.id}:${account.mountKey}` : "guest"}
        storage={adapter}
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
            setBoot({ kind: "guest" });
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
