import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const directory = process.argv[2] ?? "dist";
try {
  const serviceWorker = await readFile(join(directory, "sw.js"), "utf8");
  const cached = new Set(
    [...serviceWorker.matchAll(/(?:\burl|["']url["'])\s*:\s*["']([^"']+)["']/g)].map((match) =>
      match[1].replace(/^\//, ""),
    ),
  );
  const workers = (await readdir(join(directory, "assets"))).filter((name) =>
    /\.worker-[\w-]+\.js$/.test(name),
  );
  if (!workers.length) throw new Error("No built engine workers found.");
  for (const worker of workers) {
    const path = `assets/${worker}`;
    if (!cached.has(path)) throw new Error(`${path} is not precached.`);
    if ((await stat(join(directory, path))).size > 8 * 1024 * 1024)
      throw new Error(`${path} exceeds the 8 MiB offline file ceiling.`);
  }
  console.log(`Verified ${workers.length} offline engine workers.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
