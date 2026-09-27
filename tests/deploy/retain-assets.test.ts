// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import request from "supertest";
import { createTestApplication } from "../server/http-fixture";

it("retains old hashed workers across releases and refuses a same-name content collision", async () => {
  const root = await mkdtemp(join(tmpdir(), "chess-assets-"));
  const source = join(root, "dist");
  const archive = join(root, "archive");
  const run = () =>
    execFileSync(process.execPath, ["deploy/retain-assets.mjs"], {
      env: { ...process.env, ASSET_SOURCE_PATH: source, ASSET_ARCHIVE_PATH: archive },
      stdio: "pipe",
    });
  try {
    await mkdir(join(source, "assets"), { recursive: true });
    await writeFile(join(source, "assets", "worker-abcdefgh.js"), "old worker");
    run();
    await rm(join(source, "assets", "worker-abcdefgh.js"));
    await writeFile(join(source, "assets", "worker-ijklmnop.js"), "new worker");
    run();
    expect(await readFile(join(archive, "worker-abcdefgh.js"), "utf8")).toBe("old worker");
    expect(await readFile(join(archive, "worker-ijklmnop.js"), "utf8")).toBe("new worker");
    await writeFile(join(source, "assets", "worker-abcdefgh.js"), "different bytes");
    expect(run).toThrow();
    expect(await readFile(join(archive, "worker-abcdefgh.js"), "utf8")).toBe("old worker");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("serves an earlier worker after switching the current frontend without returning HTML for missing assets", async () => {
  const root = await mkdtemp(join(tmpdir(), "chess-old-worker-"));
  const current = join(root, "current");
  const archive = join(root, "archive");
  await mkdir(current);
  await mkdir(archive);
  await writeFile(join(current, "index.html"), "new frontend");
  await writeFile(join(archive, "worker-abcdefgh.js"), "self.onmessage=()=>postMessage('old');");
  await writeFile(join(archive, ".private"), "not served");
  const app = await createTestApplication({
    databasePath: join(root, "test.sqlite"),
    baseURL: "http://127.0.0.1:4317",
    secret: "synthetic-test-secret-with-at-least-32-characters",
    staticDir: current,
    assetArchivePath: archive,
  });
  try {
    const old = await request(app.app).get("/assets/worker-abcdefgh.js").expect(200);
    expect(old.text).toContain("postMessage('old')");
    expect(old.headers["cache-control"]).toContain("immutable");
    await request(app.app)
      .get("/assets/missing-abcdefgh.js")
      .set("Accept", "text/html")
      .expect(404);
    await request(app.app).get("/assets/.private").expect(404);
    expect((await request(app.app).get("/").expect(200)).text).toBe("new frontend");
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
