import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { arch, cpus, platform } from "node:os";

test("measures cold worker initialization separately from chess search", async ({
  browser,
  baseURL,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "This is a local Mac measurement, not phone evidence.",
  );
  const files = (await readdir("dist/assets"))
    .filter((file) => /^(engine|tal|fischer|spassky)\.worker-[\w-]+\.js$/.test(file))
    .sort();
  expect(files).toHaveLength(4);
  const results = [];
  for (const file of files) {
    const samples = [];
    for (let repetition = 0; repetition < 5; repetition++) {
      const context = await browser.newContext({ serviceWorkers: "block" });
      try {
        const page = await context.newPage();
        await page.route("**/api/auth/get-session", (route) =>
          route.fulfill({ status: 200, contentType: "application/json", body: "null" }),
        );
        await page.goto(baseURL!);
        const elapsed = await page.evaluate(async (path) => {
          const module = new URL(path, location.href).href;
          const wrapper = URL.createObjectURL(
            new Blob(
              [`import ${JSON.stringify(module)}; self.postMessage({kind:'measurement-ready'});`],
              { type: "application/javascript" },
            ),
          );
          try {
            return await new Promise<number>((resolve, reject) => {
              const started = performance.now();
              const worker = new Worker(wrapper, { type: "module" });
              const timer = setTimeout(() => {
                worker.terminate();
                reject(Error("Worker startup timed out"));
              }, 10000);
              worker.onmessage = (event) => {
                if (event.data?.kind !== "measurement-ready") return;
                const elapsed = performance.now() - started;
                clearTimeout(timer);
                worker.terminate();
                resolve(elapsed);
              };
              worker.onerror = () => {
                clearTimeout(timer);
                worker.terminate();
                reject(Error("Worker initialization failed"));
              };
            });
          } finally {
            URL.revokeObjectURL(wrapper);
          }
        }, `/assets/${file}`);
        samples.push(elapsed);
      } finally {
        await context.close();
      }
    }
    results.push({
      file,
      sha256: createHash("sha256")
        .update(await readFile(`dist/assets/${file}`))
        .digest("hex"),
      samplesMs: samples,
      medianMs: [...samples].sort((a, b) => a - b)[2],
      maximumMs: Math.max(...samples),
    });
  }
  const evidence = {
    purpose: "cold-module-startup-only-no-search",
    platform: platform(),
    architecture: arch(),
    cpu: cpus()[0].model,
    browser: browser.version(),
    context:
      "fresh browser context per sample; service workers disabled; loopback network; filesystem/OS caches not cleared",
    actualPhone: false,
    results,
  };
  const path = info.outputPath("worker-startup.json");
  await writeFile(path, JSON.stringify(evidence, null, 2) + "\n");
  await info.attach("worker-startup", { path, contentType: "application/json" });
});
