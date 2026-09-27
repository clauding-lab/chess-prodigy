/** Browser-enforced ownership. Messages request release; only the lock grants ownership. */
export const writerLockName = (identity: string) => `chess-prodigy:writer:${identity}`;
export interface WriterLease {
  identity: string;
  active(): boolean;
  release(): void;
}
interface Options {
  locks?: LockManager | null;
  channel?: typeof BroadcastChannel | null;
  wait?: boolean;
  signal?: AbortSignal;
}
export function acquireWriter(
  identity: string,
  onHandover: () => void,
  options: Options = {},
): Promise<WriterLease | null> {
  const locks = options.locks === undefined ? navigator.locks : options.locks;
  const Channel = options.channel === undefined ? globalThis.BroadcastChannel : options.channel;
  if (!locks) return Promise.resolve(null);
  const openChannel = (name: string) => {
    try {
      return Channel ? new Channel(name) : null;
    } catch {
      return null;
    } // Handover messages are optional; lock ownership is mandatory.
  };
  return new Promise((resolve) => {
    const name = writerLockName(identity);
    if (options.wait && Channel) {
      const request = openChannel(name);
      try {
        request?.postMessage("release-writer");
      } catch {
        // Without messaging, takeover still waits for the other tab to close.
      } finally {
        request?.close();
      }
    }
    void locks
      .request(
        name,
        options.wait
          ? { mode: "exclusive", signal: options.signal }
          : { mode: "exclusive", ifAvailable: true },
        async (lock) => {
          if (!lock) {
            resolve(null);
            return;
          }
          let active = true;
          let release!: () => void;
          const held = new Promise<void>((done) => {
            release = done;
          });
          const channel = openChannel(name);
          const lease: WriterLease = {
            identity,
            active: () => active,
            release: () => {
              if (!active) return;
              active = false;
              channel?.close();
              release();
            },
          };
          if (channel)
            channel.onmessage = (event) => {
              if (event.data !== "release-writer" || !active) return;
              onHandover();
              lease.release();
            };
          resolve(lease);
          await held;
        },
      )
      .catch(() => resolve(null));
  });
}
