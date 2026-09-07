import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { multiplayerRequest } from "./api";
import type { ChatState } from "./chat-types";

export function Chat({
  gameId,
  userId,
  alertTarget,
}: {
  gameId: string;
  userId: string;
  alertTarget: HTMLElement | null;
}) {
  const [data, setData] = useState<ChatState | null>(null);
  const [text, setText] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [sendError, setSendError] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [unread, setUnread] = useState(false);
  const logVisible = useRef(false);
  const send = useRef<((action: string, extra?: Record<string, unknown>) => Promise<void>) | null>(
    null,
  );
  const lastTyping = useRef(0);
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = log.current;
    if (!element) return;
    const readIfVisible = () => {
      if (logVisible.current && document.visibilityState === "visible") setUnread(false);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        logVisible.current = entry.isIntersecting && entry.intersectionRatio >= 0.5;
        readIfVisible();
      },
      { threshold: [0, 0.5] },
    );
    observer.observe(element);
    document.addEventListener("visibilitychange", readIfVisible);
    return () => {
      observer.disconnect();
      logVisible.current = false;
      document.removeEventListener("visibilitychange", readIfVisible);
    };
  }, []);
  useEffect(() => {
    let active = true;
    let stopped = false;
    let polling = false;
    let epoch = "";
    let revision = -1;
    let lastIncomingId: string | undefined;
    const clientId = crypto.randomUUID();
    const path = `/${encodeURIComponent(gameId)}/chat`;
    setData(null);
    setText("");
    setConnectionError("");
    setSendError("");
    setSending(false);
    setUnread(false);
    const accept = (next: ChatState) => {
      if (!active || next.revision < revision) return;
      if (epoch && epoch !== next.epoch) {
        setText("");
        setUnread(false);
        lastIncomingId = undefined;
        setNotice("Chat cleared because a player left or disconnected.");
      }
      const incomingId = next.messages.filter((message) => message.userId !== userId).at(-1)?.id;
      if (incomingId && incomingId !== lastIncomingId) {
        setUnread(!logVisible.current || document.visibilityState !== "visible");
      }
      lastIncomingId = incomingId;
      epoch = next.epoch;
      revision = next.revision;
      setData(next);
      setConnectionError("");
    };
    const request = async (action: string, extra: Record<string, unknown> = {}) => {
      const next = await multiplayerRequest<ChatState>(userId, path, {
        action,
        clientId,
        epoch,
        ...extra,
      });
      accept(next);
    };
    const poll = async () => {
      if (!active || polling || !epoch) return;
      polling = true;
      try {
        await request("poll");
      } catch (reason) {
        if (active) {
          setData(null);
          setConnectionError(reason instanceof Error ? reason.message : "Chat disconnected.");
        }
      } finally {
        polling = false;
      }
    };
    void request("join")
      .then(() => {
        if (active) send.current = request;
      })
      .catch((reason: unknown) => {
        if (active)
          setConnectionError(reason instanceof Error ? reason.message : "Chat unavailable.");
      });
    const timer = window.setInterval(() => void poll(), 2000);
    const leave = () => {
      if (stopped) return;
      stopped = true;
      active = false;
      send.current = null;
      window.clearInterval(timer);
      // Best effort on tab close; server expiry clears missed departures within 30 seconds.
      void fetch(`/api/multiplayer${path}`, {
        method: "POST",
        credentials: "same-origin",
        keepalive: true,
        headers: { "Content-Type": "application/json", "X-Chess-Account": userId },
        body: JSON.stringify({ action: "leave", clientId }),
      }).catch(() => {});
    };
    const pageHide = () => {
      leave();
      setData(null);
      setText("");
      setUnread(false);
    };
    const pageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setAttempt((value) => value + 1);
    };
    window.addEventListener("pagehide", pageHide);
    window.addEventListener("pageshow", pageShow);
    return () => {
      leave();
      window.removeEventListener("pagehide", pageHide);
      window.removeEventListener("pageshow", pageShow);
    };
  }, [gameId, userId, attempt]);
  const lastMessageId = data?.messages.at(-1)?.id;
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [lastMessageId, data?.epoch]);
  return (
    <section className="panel match-chat" aria-label="Match chat">
      {alertTarget &&
        createPortal(
          <button
            className="btn chat-jump"
            aria-label={unread ? "Chat, unread messages" : "Chat"}
            onClick={() => {
              log.current?.scrollIntoView({ block: "center", behavior: "instant" });
              log.current?.focus({ preventScroll: true });
              setUnread(false);
            }}
          >
            Chat
            {unread && <span className="chat-unread-dot" aria-hidden="true" />}
            <span className="sr-only" role="status">
              {unread ? "New chat message" : ""}
            </span>
          </button>,
          alertTarget,
        )}
      <h2>Chat</h2>
      <p className="form-note">
        Chat clears when either player leaves, or after about 30 seconds if a connection drops.
      </p>
      <div
        className="chat-log"
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
        ref={log}
        tabIndex={-1}
      >
        {data?.messages.map((message) => (
          <p className={message.userId === userId ? "chat-own" : ""} key={message.id}>
            <span className="chat-sender">{message.userId === userId ? "You" : "Opponent"}</span>
            <span>{message.text}</span>
          </p>
        ))}
      </div>
      <div className="chat-typing" role="status">
        {data?.typing && (
          <>
            <span>Opponent is typing…</span>
            <span className="typing-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </>
        )}
      </div>
      {notice && (
        <p className="form-note" role="status">
          {notice}
        </p>
      )}
      {connectionError && (
        <div role="alert">
          <p>{connectionError}</p>
          <button className="btn" onClick={() => setAttempt((value) => value + 1)}>
            Reconnect chat
          </button>
        </div>
      )}
      {sendError && <p role="alert">{sendError}</p>}
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const request = send.current;
          if (!request || !data || sending || !text.trim()) return;
          setSending(true);
          setSendError("");
          try {
            await request("send", { text });
            if (send.current === request) setText("");
          } catch (reason) {
            if (send.current === request)
              setSendError(
                reason instanceof Error
                  ? reason.message
                  : "Message was not confirmed. Please try again.",
              );
          } finally {
            if (send.current === request) setSending(false);
          }
        }}
      >
        <label>
          Message
          <input
            value={text}
            maxLength={1000}
            autoComplete="off"
            disabled={!data || sending}
            placeholder="Say hello…"
            onChange={(event) => {
              const value = event.target.value;
              setText(value);
              if (send.current && (!value || Date.now() - lastTyping.current > 1500)) {
                lastTyping.current = Date.now();
                // Typing is transient; a failed update expires automatically on the recipient.
                void send.current("typing", { typing: !!value }).catch(() => {});
              }
            }}
          />
        </label>
        <button className="btn primary" type="submit" disabled={!data || sending || !text.trim()}>
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
    </section>
  );
}
