// @vitest-environment node
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { executeFinalStrength } from "../../scripts/engine-bench/final-programme";
import { playStrengthGame } from "../../scripts/engine-bench/strength-match";
it("retains the first unresolved game, stops and refuses any restart", async () => {
  const directory = mkdtempSync(join(tmpdir(), "final-strength-test-"));
  const play = vi.fn(async (row) =>
    playStrengthGame(row, async () => {
      throw new Error("synthetic failure");
    }),
  );
  await expect(executeFinalStrength(directory, "digest", () => {}, play)).rejects.toThrow(
    /Unresolved/,
  );
  expect(play).toHaveBeenCalledOnce();
  expect(readdirSync(join(directory, "games"))).toHaveLength(1);
  const game = JSON.parse(
    readFileSync(join(directory, "games", readdirSync(join(directory, "games"))[0]), "utf8"),
  );
  expect(game.game.failure).toBe("synthetic failure");
  await expect(executeFinalStrength(directory, "digest", () => {}, play)).rejects.toThrow();
  expect(play).toHaveBeenCalledOnce();
});
it("blocks source drift before any game is started", async () => {
  const directory = mkdtempSync(join(tmpdir(), "final-strength-test-")),
    play = vi.fn();
  await expect(
    executeFinalStrength(
      directory,
      "digest",
      () => {
        throw new Error("drift");
      },
      play,
    ),
  ).rejects.toThrow("drift");
  expect(play).not.toHaveBeenCalled();
});
it("retains malformed non-JSON game output and uncloneable thrown values", async () => {
  for (const mode of ["return", "throw"]) {
    const directory = mkdtempSync(join(tmpdir(), "final-strength-test-"));
    const invalid = { nodes: 1n };
    await expect(
      executeFinalStrength(
        directory,
        "digest",
        () => {},
        async () => {
          if (mode === "throw") throw () => "uncloneable";
          return invalid as never;
        },
      ),
    ).rejects.toBeDefined();
    const files = readdirSync(join(directory, "games"));
    expect(files).toHaveLength(1);
    const record = JSON.parse(readFileSync(join(directory, "games", files[0]), "utf8"));
    expect(record.ok).toBe(false);
    if (mode === "return") expect(record.retained.binary).toEqual(expect.any(String));
    else expect(record.retained.serializationError).toEqual(expect.any(String));
  }
});
