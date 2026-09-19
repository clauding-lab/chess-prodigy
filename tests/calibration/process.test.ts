import { expect, test } from "vitest";
import { runProcess } from "./process";

test("subprocess waits keep the test worker responsive and preserve output", async () => {
  let heartbeat = false;
  const timer = setTimeout(() => {
    heartbeat = true;
  }, 20);
  try {
    const result = await runProcess(process.execPath, [
      "-e",
      "setTimeout(() => console.log('complete'), 100)",
    ]);
    expect(heartbeat).toBe(true);
    expect(result).toEqual({ status: 0, stdout: "complete\n", stderr: "" });
  } finally {
    clearTimeout(timer);
  }
});

test("expected nonzero exits preserve status and stderr for rejection assertions", async () => {
  const result = await runProcess(process.execPath, [
    "-e",
    "console.error('rejected'); process.exit(7)",
  ]);
  expect(result).toEqual({ status: 7, stdout: "", stderr: "rejected\n" });
});

test("a killed subprocess rejects instead of masquerading as an expected rejection", async () => {
  await expect(
    runProcess(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { timeout: 100 }),
  ).rejects.toMatchObject({ killed: true });
});
