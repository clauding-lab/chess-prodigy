// Persisted rating dates use four-digit years in Bangladesh time.
export const BDT_OFFSET_MS = 6 * 60 * 60 * 1000;
export const MAX_GAME_TIMESTAMP = Date.parse("9999-12-31T17:59:59.999Z");
export function isGameTimestamp(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_GAME_TIMESTAMP
  );
}
export function ratingDate(now: number): string {
  // Invalid direct callers produce an invalid record for validation, never a
  // fabricated date or a RangeError that interrupts recovery of the raw save.
  // Receipt validation reconstructs BDT midnight, which can precede epoch.
  return Number.isSafeInteger(now) &&
    now >= Date.parse("0000-01-01T00:00:00+06:00") &&
    now <= MAX_GAME_TIMESTAMP
    ? new Date(now + BDT_OFFSET_MS).toISOString().slice(0, 10)
    : "";
}
