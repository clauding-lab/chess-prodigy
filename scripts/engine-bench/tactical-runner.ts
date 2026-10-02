import {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { serialize } from "node:v8";
import {
  createTacticalManifest,
  sha256,
  type FreezeSettings,
  type TacticalManifest,
  type TacticalTask,
} from "./tactical-manifest";
import { assembleTacticalReport, validateTacticalEvidence } from "./tactical-evidence";
const SLOT = "coherent-v1-final";
export function exclusive(path: string, value: string) {
  const fd = openSync(path, "wx", 0o600);
  try {
    writeFileSync(fd, value);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  const parent = openSync(dirname(path), "r");
  try {
    fsyncSync(parent);
  } finally {
    closeSync(parent);
  }
}
const json = (value: unknown) => JSON.stringify(value, null, 2);
export function retained(value: unknown) {
  let readable: unknown = null,
    binary: string | null = null,
    serializationError: string | null = null;
  try {
    readable = JSON.parse(JSON.stringify(value));
  } catch {
    /* Binary retains cyclic and BigInt evidence. */
  }
  try {
    binary = serialize(value).toString("base64");
  } catch (error) {
    serializationError = String(error);
  }
  return { readable, binary, serializationError };
}
export interface FrozenTacticalRun {
  directory: string;
  registry: string;
  digest: string;
  manifest: TacticalManifest;
}
export function freezeTacticalRun(
  options: FreezeSettings & { directory: string; registry: string; loadDataset: () => string },
): FrozenTacticalRun {
  const directory = resolve(options.directory),
    registry = resolve(options.registry);
  if (options.purpose === "final") {
    mkdirSync(registry, { recursive: true });
    exclusive(
      join(registry, SLOT + ".claim.json"),
      json({ directory, datasetSha: options.datasetSha, context: options.context }),
    );
  }
  mkdirSync(directory); // Exclusive; a failed freeze retains this directory and any final claim.
  const raw = options.loadDataset();
  exclusive(join(directory, "dataset.json"), raw);
  const settings: FreezeSettings = {
    purpose: options.purpose,
    datasetSha: options.datasetSha,
    expectedCount: options.expectedCount,
    context: options.context,
    nonce: options.nonce,
  };
  const manifest = createTacticalManifest(raw, settings),
    encoded = json(manifest),
    digest = sha256(encoded);
  exclusive(join(directory, "manifest.json"), encoded);
  exclusive(join(directory, "manifest.sha256"), digest);
  if (settings.purpose === "final")
    exclusive(join(registry, SLOT + ".bound.json"), json({ directory, digest }));
  mkdirSync(join(directory, "starts"));
  mkdirSync(join(directory, "results"));
  return { directory, registry, digest, manifest };
}
function verify(frozen: FrozenTacticalRun, context: () => string) {
  const encoded = readFileSync(join(frozen.directory, "manifest.json"), "utf8");
  if (
    sha256(encoded) !== frozen.digest ||
    readFileSync(join(frozen.directory, "manifest.sha256"), "utf8") !== frozen.digest
  )
    throw new Error("Changed manifest");
  const m = JSON.parse(encoded) as TacticalManifest;
  const rebuilt = createTacticalManifest(
    readFileSync(join(frozen.directory, "dataset.json"), "utf8"),
    m.settings,
  );
  if (json(rebuilt) !== encoded) throw new Error("Changed schedule");
  if (m.settings.purpose === "final") {
    const claim = JSON.parse(readFileSync(join(frozen.registry, SLOT + ".claim.json"), "utf8"));
    const bound = JSON.parse(readFileSync(join(frozen.registry, SLOT + ".bound.json"), "utf8"));
    if (
      claim.directory !== frozen.directory ||
      claim.datasetSha !== m.settings.datasetSha ||
      claim.context !== m.settings.context ||
      bound.directory !== frozen.directory ||
      bound.digest !== frozen.digest
    )
      throw new Error("Invalid final claim");
  }
  if (context() !== m.settings.context) throw new Error("Changed execution context");
  return m;
}
export async function executeTacticalRun(
  frozen: FrozenTacticalRun,
  context: () => string,
  execute: (task: TacticalTask, manifest: TacticalManifest) => Promise<unknown>,
) {
  // Consume before any validation: even a failed start is not silently retried.
  exclusive(join(frozen.directory, "run-start.json"), json({ digest: frozen.digest }));
  const m = verify(frozen, context);
  if (
    readdirSync(join(frozen.directory, "starts")).length ||
    readdirSync(join(frozen.directory, "results")).length
  )
    throw new Error("Pre-existing task evidence");
  const resultHashes: Record<string, string> = {};
  const startHashes: Record<string, string> = {};
  for (const task of m.tasks) {
    const marker = json({ digest: frozen.digest, task });
    exclusive(join(frozen.directory, "starts", task.key + ".json"), marker);
    startHashes[task.key] = sha256(marker);
    let output: unknown;
    try {
      if (context() !== m.settings.context) throw new Error("Changed execution context");
      // Never expose the authoritative in-memory objects to a caller's executor.
      output = await execute(structuredClone(task), structuredClone(m));
      if (context() !== m.settings.context) throw new Error("Changed execution context");
      validateTacticalEvidence(m, task, output);
      const encoded = json({ key: task.key, digest: frozen.digest, ok: true, output });
      exclusive(join(frozen.directory, "results", task.key + ".json"), encoded);
      resultHashes[task.key] = sha256(encoded);
    } catch (error) {
      const detail = error as { evidence?: unknown };
      const failure = retained(detail?.evidence ?? null),
        reply = retained(output);
      exclusive(
        join(frozen.directory, "results", task.key + ".json"),
        json({
          key: task.key,
          digest: frozen.digest,
          ok: false,
          message: error instanceof Error ? error.message : String(error),
          evidence: failure.readable,
          evidenceV8Base64: failure.binary,
          evidenceSerializationError: failure.serializationError,
          outputV8Base64: reply.binary,
          outputSerializationError: reply.serializationError,
        }),
      );
      throw error;
    }
  }
  verify(frozen, context);
  exclusive(
    join(frozen.directory, "run-complete.json"),
    json({ digest: frozen.digest, count: m.tasks.length, resultHashes, startHashes }),
  );
}
export function assembleTacticalRun(frozen: FrozenTacticalRun, context: () => string) {
  const m = verify(frozen, context);
  const start = JSON.parse(readFileSync(join(frozen.directory, "run-start.json"), "utf8"));
  const complete = JSON.parse(readFileSync(join(frozen.directory, "run-complete.json"), "utf8"));
  if (
    start.digest !== frozen.digest ||
    complete.digest !== frozen.digest ||
    complete.count !== m.tasks.length
  )
    throw new Error("Incomplete run");
  const expected = m.tasks.map((t) => t.key + ".json").sort();
  for (const folder of ["starts", "results"])
    if (json(readdirSync(join(frozen.directory, folder)).sort()) !== json(expected))
      throw new Error("Missing or extra evidence");
  const records = m.tasks.map((task) => {
    const markerText = readFileSync(join(frozen.directory, "starts", task.key + ".json"), "utf8");
    if (complete.startHashes?.[task.key] !== sha256(markerText))
      throw new Error("Changed task start");
    const marker = JSON.parse(markerText);
    const encoded = readFileSync(join(frozen.directory, "results", task.key + ".json"), "utf8");
    if (complete.resultHashes?.[task.key] !== sha256(encoded))
      throw new Error("Changed task evidence");
    const record = JSON.parse(encoded);
    if (
      marker.digest !== frozen.digest ||
      json(marker.task) !== json(task) ||
      record.digest !== frozen.digest ||
      record.key !== task.key ||
      record.ok !== true
    )
      throw new Error("Failed or mismatched task");
    return record;
  });
  return assembleTacticalReport(m, records);
}
