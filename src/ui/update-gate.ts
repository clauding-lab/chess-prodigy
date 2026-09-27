export interface UpdateView {
  active: boolean;
  save(): boolean;
  ready?(): Promise<boolean>;
}
const views = new Set<() => UpdateView>();
let generation = 0;
export function registerUpdateView(view: () => UpdateView): () => void {
  views.add(view);
  generation++;
  return () => {
    views.delete(view);
    generation++;
  };
}
const assertIdle = () => {
  if ([...views].some((view) => view().active))
    throw new Error("Finish the active game before updating the app.");
};

/** Fail closed for old, silent and uncontrolled tabs; never infer that silence means idle. */
export async function soleAppClient(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || typeof MessageChannel === "undefined") return false;
  const registration = await navigator.serviceWorker.getRegistration();
  const worker = registration?.waiting;
  if (!worker) return false;
  return new Promise<boolean>((resolve) => {
    const channel = new MessageChannel();
    const finish = (safe: boolean) => {
      clearTimeout(timer);
      channel.port1.close();
      channel.port2.close();
      resolve(safe);
    };
    const timer = setTimeout(() => finish(false), 3000);
    channel.port1.onmessage = (event) =>
      finish(event.data?.kind === "chess-update-clients" && event.data.sole === true);
    try {
      worker.postMessage({ kind: "chess-update-clients" }, [channel.port2]);
    } catch {
      finish(false);
    }
  });
}

export async function prepareAppUpdate(checkClients = soleAppClient): Promise<void> {
  const started = generation;
  const assertCurrent = () => {
    if (generation !== started || views.size === 0)
      throw new Error("The open game or account changed. Please retry the update.");
    assertIdle();
  };
  assertCurrent();
  for (const read of views) {
    const view = read();
    if (!view.save()) throw new Error("Could not save your game. The update has been postponed.");
    if (view.ready && !(await view.ready()))
      throw new Error("Account sync is still pending. Sync your changes before updating.");
    assertCurrent();
  }
  if (!(await checkClients()))
    throw new Error("Close other Chess Prodigy tabs or windows, then retry the update.");
  assertCurrent();
}
