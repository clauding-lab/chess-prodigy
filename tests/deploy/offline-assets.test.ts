// @vitest-environment node
import { mkdtempSync, mkdirSync, writeFileSync, truncateSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, expect, it } from "vitest";

const directories: string[] = [];
afterEach(() => {
  for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function build(cached: boolean, bytes = 1) {
  const dir = mkdtempSync(join(tmpdir(), "chess-offline-assets-"));
  directories.push(dir);
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "assets/tal.worker-fixture.js"), "x");
  truncateSync(join(dir, "assets/tal.worker-fixture.js"), bytes);
  writeFileSync(
    join(dir, "sw.js"),
    `precacheAndRoute([${cached ? '{url:"assets/tal.worker-fixture.js",revision:null}' : ""}]);`,
  );
  return dir;
}
function check(dir: string) {
  return spawnSync(process.execPath, ["scripts/check-offline-assets.mjs", dir], {
    encoding: "utf8",
    timeout: 5000,
  });
}
it("accepts cached workers within the offline size ceiling", () => {
  const result = check(build(true));
  expect(result.status, result.stderr).toBe(0);
});
it("rejects a built worker omitted from the offline precache", () => {
  const result = check(build(false));
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("not precached");
});
it("rejects an oversized worker even if a partial service worker was emitted", () => {
  const result = check(build(true, 8 * 1024 * 1024 + 1));
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("exceeds");
});
