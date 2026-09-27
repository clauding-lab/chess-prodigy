import { decodeCompactSession } from "./compact";
import { parseSavedState } from "./schema";
import type { Session } from "../game/types";

/** Decode each explicit wire generation without rewriting its original acknowledgement. */
export function parseSessionInput(
  value: unknown,
  options: { preserveDerived?: boolean } = {},
): Session | null {
  if (value !== null && typeof value === "object" && "version" in value && value.version === 3)
    return decodeCompactSession(value);
  return parseSavedState(value, options);
}
