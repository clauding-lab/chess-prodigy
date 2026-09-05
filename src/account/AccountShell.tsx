import { useEffect, useMemo, useRef, useState } from "react";
import App from "../App";
import { freshSession } from "../game/state";
import type { GameStorageAdapter } from "../game/useGame";
import { Modal } from "../ui/Modal";
import { ApiError, getAccountSession, getRecords, signOut } from "./api";
import { AccountModal, AuthModal, LeaderboardModal } from "./AccountModals";
import { AccountSync, type AccountSyncStatus } from "./sync";
import type { AccountUser, RecordsEnvelope } from "./types";

type Boot =
  | { kind: "loading" }
  | { kind: "guest" }
  | { kind: "auth-error"; message: string }
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
  const accountRequest = useRef(0);
  const [boot, setBoot] = useState<Boot>({ kind: "loading" });
  const [authOpen, setAuthOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<AccountSyncStatus | null>(null);

  useEffect(() => {
    let active = true;
    void getAccountSession()
      .then(async (user) => {
        if (!active) return;
        if (!user) {
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
    const initial = sync.initialize(remote, !offline);
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

  const adapter = useMemo<GameStorageAdapter | undefined>(() => {
    if (boot.kind !== "account") return undefined;
    let timer: number | undefined;
    let hasChanged = false;
    return {
      load: () => ({
        session: boot.initial,
        status: "saved",
        hasSavedGame: boot.initial.game.started && !boot.initial.game.over,
      }),
      save: (session, options) => {
        if (!hasChanged && JSON.stringify(session) === JSON.stringify(boot.initial)) return true;
        hasChanged = true;
        const saved = boot.sync.save(session, options);
        window.clearTimeout(timer);
        if (options?.terminal) void boot.sync.flush();
        else timer = window.setTimeout(() => void boot.sync.flush(), 1000);
        return saved;
      },
    };
  }, [boot]);

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
  const account = boot.kind === "account" ? boot : null;
  const controls = (
    <div className="account-bar">
      {account && syncStatus && (
        <span className="cloud-status" role="status">
          {syncStatus.state === "syncing"
            ? "Saving…"
            : syncStatus.state === "idle" && syncStatus.pending === 0
              ? "Saved to account"
              : "Pending changes"}
        </span>
      )}
      <button className="linkbtn" onClick={() => setLeaderboardOpen(true)}>
        Leaderboard
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
    </div>
  );
  const conflict = account && syncStatus?.state === "conflict";
  return (
    <>
      <App
        key={account ? `${account.user.id}:${account.mountKey}` : "guest"}
        storage={adapter}
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
          ) : syncStatus?.state === "signed-out" ? (
            <>
              Your session ended.{" "}
              <button className="linkbtn" onClick={() => setAuthOpen(true)}>
                Sign in again
              </button>{" "}
              to sync saved account changes.
            </>
          ) : syncStatus?.state === "storage-error" ? (
            "Account storage is unavailable in this browser. Keep this tab open while you finish playing."
          ) : null
        }
      />
      {authOpen && (
        <AuthModal
          onClose={() => setAuthOpen(false)}
          onAuthenticated={(user) => void openAccount(user)}
        />
      )}
      {accountOpen && account && (
        <AccountModal
          user={account.user}
          onClose={() => setAccountOpen(false)}
          onSignOut={async () => {
            await signOut(account.user.id);
            invalidateAccountRequest(accountRequest);
            account.sync.dispose();
            setAccountOpen(false);
            setBoot({ kind: "guest" });
          }}
        />
      )}
      {leaderboardOpen && <LeaderboardModal onClose={() => setLeaderboardOpen(false)} />}
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
