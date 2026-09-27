/** Revisions reject stale local writers inside an exclusive browser lease.
 * They are not an atomic lock and must never be used as a replacement for one. */
export function readStorageRevision(raw: string | null): number | null {
  if (raw === null) return 0;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    if (!("storageRevision" in value)) return 0;
    return Number.isSafeInteger(value.storageRevision) && Number(value.storageRevision) >= 0
      ? Number(value.storageRevision)
      : null;
  } catch {
    return null;
  }
}
export interface WriteRevision {
  expectedRevision?: number;
}
