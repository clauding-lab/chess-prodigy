import { createHash, randomUUID } from "node:crypto";
import { copyFile, link, lstat, mkdir, readFile, readdir, unlink, utimes } from "node:fs/promises";
import { join, resolve } from "node:path";

// Public build artifacts only. This never copies saves, databases, environment files or source.
const source = resolve(process.env.ASSET_SOURCE_PATH ?? "dist", "assets");
if (!process.env.ASSET_ARCHIVE_PATH) throw new Error("ASSET_ARCHIVE_PATH is required.");
const archive = resolve(process.env.ASSET_ARCHIVE_PATH);
if (source === archive) throw new Error("The asset archive must be separate from this release.");
await mkdir(archive, { recursive: true, mode: 0o755 });
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
let retained = 0;
for (const entry of await readdir(source, { withFileTypes: true })) {
  if (
    !entry.isFile() ||
    !/^[a-zA-Z0-9_.-]+-[a-zA-Z0-9_-]{8,}\.(js|css|wasm|woff2?|png|svg|webp)$/.test(entry.name)
  )
    throw new Error(`Unexpected asset entry: ${entry.name}`);
  const input = join(source, entry.name);
  const output = join(archive, entry.name);
  const partial = join(archive, `.asset-${randomUUID()}.partial`);
  try {
    await copyFile(input, partial);
    try {
      // Link is atomic and exclusive: no reader can observe a half-written asset.
      await link(partial, output);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (
        !(await lstat(output)).isFile() ||
        digest(await readFile(output)) !== digest(await readFile(partial))
      )
        throw new Error(`Immutable asset collision: ${entry.name}`);
    }
    const now = new Date();
    await utimes(output, now, now); // Last included release; supports reviewed retention later.
    retained++;
  } finally {
    await unlink(partial).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}
console.log(`Retained ${retained} immutable public assets. No old assets deleted.`);
