const listeners = new Set<(accountId: string) => void>();
export function subscribeSessionExpiry(listener: (accountId: string) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function reportSessionExpiry(accountId: string): void {
  for (const listener of listeners) listener(accountId);
}
