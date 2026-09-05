import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { createApplication } from "../server/app.js";

const directory = await mkdtemp(join(tmpdir(), "chess-prodigy-browser-"));
const application = await createApplication({
  databasePath: join(directory, "test.sqlite"),
  baseURL: "http://127.0.0.1:4318",
  secret: randomBytes(48).toString("hex"),
  staticDir: "dist",
});
const server = createServer(application.app);
server.listen(4318, "127.0.0.1");
let closing = false;
function close() {
  if (closing) return;
  closing = true;
  server.close(() => {
    application.close();
    void rm(directory, { recursive: true, force: true }).then(() => process.exit(0));
  });
  server.closeAllConnections();
}
process.on("SIGTERM", close);
process.on("SIGINT", close);
