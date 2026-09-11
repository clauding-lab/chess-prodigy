/** Serializable game identity. Display names never select engine behaviour. */
export interface OpponentConfig {
  id: string;
  version: number;
  engine: string;
  randomPolicy: string;
  seed: number | null;
}

export const CLASSIC: Readonly<OpponentConfig> = Object.freeze({
  id: "classic",
  version: 1,
  engine: "classic-v1",
  randomPolicy: "ambient-v1",
  seed: null,
});

export function morphyConfig(seed: number): OpponentConfig {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error("Invalid opponent seed.");
  return {
    id: "attack-development",
    version: 1,
    engine: "style-v1",
    randomPolicy: "seeded-per-ply-v1",
    seed,
  };
}

export function isOpponentConfig(value: unknown): value is OpponentConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const c = value as Partial<OpponentConfig>;
  return (
    [c.id, c.engine, c.randomPolicy].every(
      (v) => typeof v === "string" && /^[a-z0-9-]{1,64}$/.test(v),
    ) &&
    Number.isSafeInteger(c.version) &&
    Number(c.version) >= 1 &&
    (c.seed === null ||
      (Number.isInteger(c.seed) && Number(c.seed) >= 0 && Number(c.seed) <= 0xffffffff))
  );
}

export function isSupportedOpponent(c: OpponentConfig): boolean {
  return (
    c.version === 1 &&
    ((c.id === "classic" &&
      c.engine === "classic-v1" &&
      c.randomPolicy === "ambient-v1" &&
      c.seed === null) ||
      (c.id === "attack-development" &&
        c.engine === "style-v1" &&
        c.randomPolicy === "seeded-per-ply-v1" &&
        c.seed !== null &&
        Number.isInteger(c.seed) &&
        c.seed >= 0 &&
        c.seed <= 0xffffffff))
  );
}

export function isRatedOpponent(c: OpponentConfig): boolean {
  return c.id === "classic" && isSupportedOpponent(c);
}

export const personalityBetaEnabled = (value: string | undefined): boolean => value === "true";
export const opponentName = (c: OpponentConfig): string =>
  c.id === "classic"
    ? "Classic"
    : c.id === "attack-development"
      ? "Paul Morphy"
      : "Unavailable opponent";
