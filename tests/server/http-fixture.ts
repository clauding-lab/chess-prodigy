import { once } from "node:events";
import type { Server } from "node:http";
import type { Express } from "express";
import { afterEach } from "vitest";
import { createApplication, type ApplicationOptions } from "../../server/app";

const servers = new Set<Server>();
export async function closeTestServer(server: Server): Promise<void> {
  servers.delete(server);
  server.closeAllConnections();
  if (server.listening)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
}
afterEach(async () => {
  await Promise.all([...servers].map(closeTestServer));
});

export async function listenForTest(app: Express): Promise<Server> {
  // Supertest connects through IPv4. A wildcard IPv6 listener on macOS can
  // share its port with an unrelated IPv4 service, sending requests there.
  const server = app.listen(0, "127.0.0.1");
  servers.add(server);
  await once(server, "listening");
  return server;
}

export async function createTestApplication(options: ApplicationOptions) {
  const application = await createApplication(options);
  try {
    const server = await listenForTest(application.app);
    return {
      app: server,
      close: async () => {
        await closeTestServer(server);
        await application.close();
      },
    };
  } catch (error) {
    await application.close();
    throw error;
  }
}
