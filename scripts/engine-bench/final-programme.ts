import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { exclusive, retained } from "./tactical-runner";
import { finalStrengthSchedule, verifyFinalGame, finalStrengthReport } from "./final-strength";
import type { StrengthRow } from "./strength-core";
import type { StrengthGame } from "./strength-match";
import { sha256 } from "./tactical-manifest";
const encode = (v: unknown) => JSON.stringify(v, null, 2);
export async function executeFinalStrength(
  directory: string,
  digest: string,
  verifyContext: () => void,
  play: (row: StrengthRow) => Promise<StrengthGame>,
) {
  exclusive(join(directory, "strength-start.json"), encode({ digest }));
  verifyContext();
  mkdirSync(join(directory, "games"));
  mkdirSync(join(directory, "game-starts"));
  const hashes: Record<string, string> = {},
    starts: Record<string, string> = {};
  for (const row of finalStrengthSchedule()) {
    verifyContext();
    const marker = encode({ digest, row });
    exclusive(join(directory, "game-starts", row.key + ".json"), marker);
    starts[row.key] = sha256(marker);
    let game: StrengthGame | undefined;
    let encoded: string;
    try {
      game = await play(structuredClone(row));
      encoded = encode({ digest, game });
    } catch (error) {
      exclusive(
        join(directory, "games", row.key + ".json"),
        encode({
          digest,
          row,
          error: String(error),
          ok: false,
          retained: retained(game ?? error),
          errorEvidence: retained((error as { evidence?: unknown })?.evidence),
        }),
      );
      throw error;
    }
    // Save before validation: every failed or malformed game remains inspectable.
    exclusive(join(directory, "games", row.key + ".json"), encoded);
    hashes[row.key] = sha256(encoded);
    verifyContext();
    verifyFinalGame(game, row);
    console.log(
      JSON.stringify({
        kind: "final-game",
        key: row.key,
        plies: game.moves.length,
        score: game.score,
      }),
    );
  }
  verifyContext();
  exclusive(join(directory, "strength-complete.json"), encode({ digest, hashes, starts }));
  return assembleFinalStrength(directory, digest, verifyContext);
}
export function assembleFinalStrength(
  directory: string,
  digest: string,
  verifyContext: () => void,
) {
  verifyContext();
  const complete = JSON.parse(readFileSync(join(directory, "strength-complete.json"), "utf8"));
  const start = JSON.parse(readFileSync(join(directory, "strength-start.json"), "utf8"));
  if (complete.digest !== digest || start.digest !== digest)
    throw new Error("Final strength identity mismatch");
  const rows = finalStrengthSchedule(),
    expected = rows.map((r) => r.key + ".json").sort();
  for (const folder of ["games", "game-starts"])
    if (encode(readdirSync(join(directory, folder)).sort()) !== encode(expected))
      throw new Error("Incomplete final strength evidence");
  const games = rows.map((row) => {
    const encoded = readFileSync(join(directory, "games", row.key + ".json"), "utf8"),
      marker = readFileSync(join(directory, "game-starts", row.key + ".json"), "utf8");
    if (
      complete.hashes?.[row.key] !== sha256(encoded) ||
      complete.starts?.[row.key] !== sha256(marker) ||
      marker !== encode({ digest, row })
    )
      throw new Error("Changed final strength evidence");
    const record = JSON.parse(encoded);
    if (record.digest !== digest) throw new Error("Final game identity mismatch");
    verifyFinalGame(record.game, row);
    return record.game as StrengthGame;
  });
  return finalStrengthReport(games);
}
