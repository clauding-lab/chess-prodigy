// @vitest-environment node
import { expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const exec = promisify(execFile);
it("refuses edited frozen settings, source and bundles before starting any game", async () => {
  const parent = mkdtempSync(join(tmpdir(), "chess-strength-freeze-")),
    directory = join(parent, "run");
  const args = ["--import", "tsx", "scripts/engine-bench/strength-run.ts"];
  try {
    await exec(process.execPath, [...args, "freeze", directory, "tal", "casual"]);
    const path = join(directory, "manifest.json"),
      original = readFileSync(path, "utf8");
    const settings = JSON.parse(original);
    settings.settings.rankingReserveMs = 0;
    writeFileSync(path, JSON.stringify(settings));
    await expect(exec(process.execPath, [...args, "run", directory])).rejects.toThrow(
      /Frozen settings mismatch/,
    );
    const source = JSON.parse(original);
    source.source["src/engine/board.ts"] = "changed";
    writeFileSync(path, JSON.stringify(source));
    await expect(exec(process.execPath, [...args, "run", directory])).rejects.toThrow(
      /Frozen source or machine mismatch/,
    );
    writeFileSync(path, original);
    writeFileSync(join(directory, "experiment.cjs"), "changed");
    await expect(exec(process.execPath, [...args, "run", directory])).rejects.toThrow(
      /Worker bundle mismatch/,
    );
    expect(readdirSync(directory).some((name) => name.endsWith(".started.json"))).toBe(false);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}, 20000);
