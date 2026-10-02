// @vitest-environment node
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import {
  freezeTacticalRun,
  executeTacticalRun,
  assembleTacticalRun,
} from "../../scripts/engine-bench/tactical-runner";
import { evidence, raw, settings } from "./tactical-fixtures";
function setup(purpose: "development" | "final" = "development") {
  const root = mkdtempSync(join(tmpdir(), "tactical-test-"));
  return {
    directory: join(root, "run"),
    registry: join(root, "registry"),
    ...settings,
    purpose,
    loadDataset: () => raw,
  };
}
it("executes a full frozen schedule once, revalidates assembly and refuses overwrite", async () => {
  const opts = setup(),
    frozen = freezeTacticalRun(opts);
  const executor = vi.fn(async (task) => evidence(frozen.manifest, task));
  await executeTacticalRun(frozen, () => settings.context, executor);
  expect(executor).toHaveBeenCalledTimes(18);
  expect(assembleTacticalRun(frozen, () => settings.context).qualification).toBe(false);
  expect(() => freezeTacticalRun(opts)).toThrow();
  await expect(executeTacticalRun(frozen, () => settings.context, executor)).rejects.toThrow();
  const record = join(opts.directory, "results", frozen.manifest.tasks[0].key + ".json");
  const saved = JSON.parse(readFileSync(record, "utf8"));
  saved.output.detail.score = 999;
  writeFileSync(record, JSON.stringify(saved));
  expect(() => assembleTacticalRun(frozen, () => settings.context)).toThrow();
});
it("claims the final slot before a failed dataset read and blocks another directory", () => {
  const opts = setup("final"),
    reader = vi.fn(() => {
      throw new Error("read failed");
    });
  expect(() => freezeTacticalRun({ ...opts, loadDataset: reader })).toThrow("read failed");
  const secondReader = vi.fn(() => raw);
  expect(() =>
    freezeTacticalRun({ ...opts, directory: opts.directory + "-other", loadDataset: secondReader }),
  ).toThrow();
  expect(secondReader).not.toHaveBeenCalled();
  expect(reader).toHaveBeenCalledOnce();
});
it("retains structured failures, consumes the run, and never executes later rows", async () => {
  const frozen = freezeTacticalRun(setup());
  const executor = vi.fn(async () => {
    throw Object.assign(new Error("crash"), { evidence: { marker: "retained" } });
  });
  await expect(executeTacticalRun(frozen, () => settings.context, executor)).rejects.toThrow(
    "crash",
  );
  expect(executor).toHaveBeenCalledOnce();
  const results = readdirSync(join(frozen.directory, "results"));
  expect(results).toHaveLength(1);
  expect(readFileSync(join(frozen.directory, "results", results[0]), "utf8")).toContain("retained");
  expect(() => assembleTacticalRun(frozen, () => settings.context)).toThrow();
  await expect(executeTacticalRun(frozen, () => settings.context, executor)).rejects.toThrow();
});
it("blocks drift before work and after a task, preserving consumed markers", async () => {
  const frozen = freezeTacticalRun(setup());
  let context = settings.context;
  const executor = vi.fn(async (task) => {
    context = "c".repeat(64);
    return evidence(frozen.manifest, task);
  });
  await expect(executeTacticalRun(frozen, () => context, executor)).rejects.toThrow(/context/);
  expect(executor).toHaveBeenCalledOnce();
  expect(() => assembleTacticalRun(frozen, () => context)).toThrow();
  const another = freezeTacticalRun(setup());
  await expect(executeTacticalRun(another, () => context, executor)).rejects.toThrow(/context/);
});
it("refuses a crash marker, altered manifest, missing/extra rows and wrong identities", async () => {
  const frozen = freezeTacticalRun(setup());
  writeFileSync(join(frozen.directory, "run-start.json"), "{}");
  await expect(
    executeTacticalRun(
      frozen,
      () => settings.context,
      async (t) => evidence(frozen.manifest, t),
    ),
  ).rejects.toThrow();
  expect(() => assembleTacticalRun(frozen, () => settings.context)).toThrow();
  writeFileSync(join(frozen.directory, "manifest.json"), "{}");
  expect(() => assembleTacticalRun(frozen, () => settings.context)).toThrow();
});
it("detects semantically valid edits, extra records and removed records after completion", async () => {
  const frozen = freezeTacticalRun(setup());
  await executeTacticalRun(
    frozen,
    () => settings.context,
    async (t) => evidence(frozen.manifest, t),
  );
  const first = frozen.manifest.tasks[0],
    file = join(frozen.directory, "results", first.key + ".json");
  const original = readFileSync(file, "utf8"),
    edited = JSON.parse(original);
  edited.output.calculationMs += 1;
  writeFileSync(file, JSON.stringify(edited));
  expect(() => assembleTacticalRun(frozen, () => settings.context)).toThrow();
  writeFileSync(file, original);
  writeFileSync(join(frozen.directory, "results", "extra.json"), original);
  expect(() => assembleTacticalRun(frozen, () => settings.context)).toThrow();
});
it("retains non-JSON exception evidence without replacing the original failure", async () => {
  const { deserialize } = await import("node:v8");
  const frozen = freezeTacticalRun(setup());
  const detail: { nodes: bigint; self?: unknown } = { nodes: 1n };
  detail.self = detail;
  await expect(
    executeTacticalRun(
      frozen,
      () => settings.context,
      async () => {
        throw Object.assign(new Error("original failure"), { evidence: detail });
      },
    ),
  ).rejects.toThrow("original failure");
  const saved = JSON.parse(
    readFileSync(join(frozen.directory, "results", frozen.manifest.tasks[0].key + ".json"), "utf8"),
  );
  const retained = deserialize(Buffer.from(saved.evidenceV8Base64, "base64"));
  expect(saved.ok).toBe(false);
  expect(retained.nodes).toBe(1n);
  expect(retained.self).toBe(retained);
});

it("blocks competing final claim before its dataset reader executes", () => {
  const opts = setup("final"),
    second = vi.fn(() => raw);
  const frozen = freezeTacticalRun({
    ...opts,
    loadDataset: () => {
      expect(() =>
        freezeTacticalRun({
          ...opts,
          directory: opts.directory + "-competitor",
          loadDataset: second,
        }),
      ).toThrow();
      return raw;
    },
  });
  expect(second).not.toHaveBeenCalled();
  expect(frozen.manifest.settings.purpose).toBe("final");
});
it("rejects missing results and edited task identities after completion", async () => {
  const frozen = freezeTacticalRun(setup());
  await executeTacticalRun(
    frozen,
    () => settings.context,
    async (t) => evidence(frozen.manifest, t),
  );
  const t = frozen.manifest.tasks[0],
    file = join(frozen.directory, "results", t.key + ".json");
  const original = readFileSync(file, "utf8");
  unlinkSync(file);
  expect(() => assembleTacticalRun(frozen, () => settings.context)).toThrow();
  const record = JSON.parse(original);
  record.key = "wrong";
  writeFileSync(file, JSON.stringify(record));
  expect(() => assembleTacticalRun(frozen, () => settings.context)).toThrow();
});
