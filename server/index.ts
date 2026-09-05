import { createServer } from "node:http";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { createApplication } from "./app.js";

const port = Number(process.env.PORT ?? 4317);
const databasePath = process.env.DATABASE_PATH;
const baseURL = process.env.BASE_URL ?? `http://127.0.0.1:${port}`;
const secret = process.env.AUTH_SECRET;

if (!databasePath) throw new Error("DATABASE_PATH is required.");
if (!secret || secret.length < 32)
  throw new Error("AUTH_SECRET must contain at least 32 characters.");
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535)
  throw new Error("PORT must be a valid TCP port.");

await mkdir(dirname(databasePath), { recursive: true });
const application = await createApplication({ databasePath, baseURL, secret, staticDir: "dist" });
const server = createServer(application.app);

server.listen(port, "127.0.0.1", () => {
  console.log(`Chess Prodigy listening on ${baseURL}`);
});

function shutdown(): void {
  server.close(() => {
    application.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
