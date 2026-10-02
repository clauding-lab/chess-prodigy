// Explicit one-shot entry point. Importing library modules never opens validation data.
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  freezeTacticalRun,
  executeTacticalRun,
  assembleTacticalRun,
  exclusive,
} from "./tactical-runner";
import {
  buildFinalBundles,
  finalContext,
  FINAL_DATASET,
  FINAL_RELATIVE,
  REGISTRY_RELATIVE,
  type FinalBundles,
} from "./final-context";
import { createTacticalExecutor } from "./tactical-worker";
import { finalStrengthSchedule } from "./final-strength";
import { executeFinalStrength } from "./final-programme";
import { playStrengthGame } from "./strength-match";
import { workerChooser } from "./strength-worker";
import { sha256 } from "./tactical-manifest";
const root = process.cwd(),
  command = process.argv[2];
if (!["preflight", "execute"].includes(command))
  throw new Error(
    "Usage: final-run.ts preflight|execute (execute consumes the single final attempt)",
  );
const bundles = buildFinalBundles(),
  context = finalContext(root, bundles);
// Preserve the already frozen playing policies: harness changes cannot silently rebuild a new candidate.
const original = JSON.parse(
  readFileSync(
    join(
      root,
      ".superpowers/sdd/2026-09-27-repair-and-engine-master-plan/strength-development-v1/fischer-casual/manifest.json",
    ),
    "utf8",
  ),
);
for (const name of ["experiment", "tal", "fischer"] as const)
  if (sha256(bundles[name]) !== original.bundles[name])
    throw new Error(`Original playing bundle drift: ${name}`);
if (JSON.stringify(context) !== JSON.stringify(finalContext(root, bundles)))
  throw new Error("Context drift during build");
if (command === "preflight")
  console.log(
    JSON.stringify(
      { preflight: true, validationOpened: false, context, scheduledGames: 1600 },
      null,
      2,
    ),
  );
else {
  if (execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim())
    throw new Error("Commit reviewed source before final freeze");
  const directory = join(root, FINAL_RELATIVE),
    registry = join(root, REGISTRY_RELATIVE);
  const header = JSON.stringify(
    {
      purpose: "single-final-coherent-v1",
      commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      context,
      dataset: FINAL_DATASET,
      qualification: false,
    },
    null,
    2,
  );
  const frozen = freezeTacticalRun({
    directory,
    registry,
    purpose: "final",
    ...FINAL_DATASET,
    context: context.digest,
    nonce: randomBytes(32).toString("hex"),
    loadDataset: () => {
      exclusive(join(directory, "programme.json"), header);
      for (const [name, source] of Object.entries(bundles))
        exclusive(join(directory, name + ".cjs"), source);
      exclusive(
        join(directory, "strength-schedule.json"),
        JSON.stringify(finalStrengthSchedule(), null, 2),
      );
      return readFileSync(
        join(root, "docs/verification/engine-improvement/e0-dataset-v1/validation.json"),
        "utf8",
      );
    },
  });
  const verify = () => {
    if (
      readFileSync(join(directory, "programme.json"), "utf8") !== header ||
      readFileSync(join(directory, "strength-schedule.json"), "utf8") !==
        JSON.stringify(finalStrengthSchedule(), null, 2)
    )
      throw new Error("Programme freeze changed");
    const stored = Object.fromEntries(
      Object.keys(bundles).map((name) => [
        name,
        readFileSync(join(directory, name + ".cjs"), "utf8"),
      ]),
    ) as FinalBundles;
    if (JSON.stringify(finalContext(root, stored)) !== JSON.stringify(context))
      throw new Error("Final source, machine or bundle drift");
    return context.digest;
  };
  try {
    const executor = createTacticalExecutor(bundles);
    await executeTacticalRun(frozen, verify, async (task, m) => {
      const output = await executor(task, m);
      console.log(JSON.stringify({ kind: "final-tactical", key: task.key }));
      return output;
    });
    const tactical = assembleTacticalRun(frozen, verify);
    exclusive(join(directory, "tactical-private-report.json"), JSON.stringify(tactical, null, 2));
    exclusive(join(directory, "anonymous-review.json"), JSON.stringify(tactical.review, null, 2));
    const strength = await executeFinalStrength(
      directory,
      frozen.digest,
      () => {
        verify();
      },
      (row) => playStrengthGame(row, workerChooser(row, bundles)),
    );
    exclusive(join(directory, "strength-report.json"), JSON.stringify(strength, null, 2));
    const statisticalCriteria =
      tactical.groups.every((g) => g.statisticalCriterion) &&
      strength.groups.every((g) => g.statisticalCriterion !== false);
    exclusive(
      join(directory, "programme-status.json"),
      JSON.stringify(
        {
          complete: true,
          qualification: false,
          statisticalCriteria,
          remaining: [
            "independent-anonymous-audit",
            "original-development-failure-disposition",
            "owner-blind-comparison",
            "physical-device-checks",
            "rated-calibration-if-proceeding",
          ],
        },
        null,
        2,
      ),
    );
  } catch (error) {
    exclusive(
      join(directory, "programme-status.json"),
      JSON.stringify(
        { complete: false, qualification: false, error: String(error), retryAllowed: false },
        null,
        2,
      ),
    );
    throw error;
  }
}
