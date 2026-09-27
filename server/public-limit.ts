import { isIP } from "node:net";
import type { RequestHandler } from "express";

/** Forwarded identity is accepted only behind the explicitly configured local tunnel. */
export function publicClientKey(
  remote: string,
  forwarded: string | undefined,
  trusted: boolean,
): string {
  const local = remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1";
  const candidate = trusted && local && forwarded && isIP(forwarded) ? forwarded : remote;
  return candidate.startsWith("::ffff:") && isIP(candidate.slice(7)) === 4
    ? candidate.slice(7)
    : candidate;
}

export function createPublicReadLimit(
  options: { trustedLocalTunnel?: boolean; now?: () => number } = {},
): RequestHandler {
  const now = options.now ?? Date.now;
  let window = -1;
  let total = 0;
  const visitors = new Map<string, number>();
  return (req, res, next) => {
    const time = now();
    const current = Math.floor(time / 60000);
    if (current !== window) {
      visitors.clear();
      total = 0;
      window = current;
    }
    const key = publicClientKey(
      req.socket.remoteAddress ?? "unknown",
      req.get("cf-connecting-ip"),
      options.trustedLocalTunnel === true,
    );
    const count = visitors.get(key) ?? 0;
    // Denied traffic consumes neither another visitor's allowance nor map entries.
    // The global ceiling also bounds this map to at most 6,000 entries per minute.
    if (count >= 60 || total >= 6000) {
      res
        .set("Retry-After", String(Math.max(1, Math.ceil(((window + 1) * 60000 - time) / 1000))))
        .status(429)
        .json({ error: "Leaderboard requests are busy. Please try again shortly." });
      return;
    }
    visitors.set(key, count + 1);
    total++;
    next();
  };
}
