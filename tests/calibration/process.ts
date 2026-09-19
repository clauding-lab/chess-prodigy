import { execFile } from "node:child_process";

// Yield while the child works so Vitest can receive status-update acknowledgements.
// Startup failures, signals, buffer overflow and deadlines must fail the test itself.
export function runProcess(
  file: string,
  args: string[],
  options: { encoding?: "utf8"; timeout?: number } = {},
): Promise<{ status: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      { encoding: "utf8", timeout: options.timeout ?? 15000, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (!error) resolve({ status: 0, stdout, stderr });
        else if (error.killed || typeof error.code !== "number") reject(error);
        else resolve({ status: error.code, stdout, stderr });
      },
    );
  });
}
