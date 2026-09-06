import { resolve } from "node:path";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import Database from "better-sqlite3";
import express, { type Express } from "express";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { createAuth } from "./auth.js";
import { createRecordsRouter, readLeaderboard } from "./records.js";
import { createMultiplayerRouter } from "./multiplayer.js";
import { createNotificationDelivery } from "./notification-delivery.js";
import { createNotificationsRouter, createNotificationWorker } from "./notifications.js";

export interface ApplicationOptions {
  databasePath: string;
  baseURL: string;
  secret: string;
  staticDir?: string;
  notifications?: boolean;
}

export interface Application {
  app: Express;
  close: () => void | Promise<void>;
}

export async function createApplication(options: ApplicationOptions): Promise<Application> {
  const database = new Database(options.databasePath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  try {
    const auth = await createAuth({ database, baseURL: options.baseURL, secret: options.secret });
    const app = express();
    app.disable("x-powered-by");
    const publicURL = new URL(options.baseURL);
    if (publicURL.protocol === "https:") {
      app.use((request, response, next) => {
        response.set("Strict-Transport-Security", "max-age=31536000");
        // The loopback-only origin receives this header from Cloudflare Tunnel.
        if (request.get("x-forwarded-proto") === "http") {
          const path = request.originalUrl.startsWith("/") ? request.originalUrl : "/";
          response.redirect(308, publicURL.origin + path);
          return;
        }
        next();
      });
    }
    app.use((_request, response, next) => {
      response.set({
        "Content-Security-Policy":
          "default-src 'self'; connect-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "same-origin",
        "X-Frame-Options": "DENY",
      });
      next();
    });
    app.use("/api", (_request, response, next) => {
      response.set("Cache-Control", "no-store");
      next();
    });
    app.use("/api/auth", async (request, response, next) => {
      const expectedAccount = request.get("x-chess-account");
      if (
        expectedAccount &&
        ["/change-password", "/sign-out", "/update-user"].includes(request.path)
      ) {
        const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
        if (!session || session.user.id !== expectedAccount) {
          response.status(401).json({ error: "The signed-in account changed. Sign in again." });
          return;
        }
      }
      next();
    });
    const authHandler = toNodeHandler(auth);
    app.all(
      "/api/auth/*splat",
      express.raw({ type: () => true, limit: "16kb" }),
      (request, response, next) => {
        const configuredURL = new URL(options.baseURL);
        const headers: Record<string, string | string[] | undefined> = {
          ...request.headers,
          host: configuredURL.host,
        };
        delete headers["x-forwarded-host"];
        delete headers["x-forwarded-proto"];
        // raw() has already decoded bounded content; don't replay its old wire encoding.
        const body = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
        delete headers["content-encoding"];
        delete headers["transfer-encoding"];
        headers["content-length"] = String(body.length);
        const replay = Readable.from(body.length ? [body] : []);
        Object.assign(replay, {
          headers,
          method: request.method,
          url: request.originalUrl,
          socket: { encrypted: configuredURL.protocol === "https:" },
        });
        void authHandler(replay as unknown as IncomingMessage, response).catch(next);
      },
    );
    app.use(express.json({ limit: "300kb", strict: true }));
    app.get("/api/health", (_request, response) => response.json({ status: "ok" }));
    app.get("/api/leaderboard", (_request, response) => response.json(readLeaderboard(database)));
    app.use("/api/records", createRecordsRouter(database, auth, options.baseURL));
    app.use("/api/multiplayer", createMultiplayerRouter(database, auth, options.baseURL));
    const delivery = createNotificationDelivery(
      options.baseURL,
      options.notifications ? process.env : {},
    );
    app.use(
      "/api/notifications",
      createNotificationsRouter(database, auth, options.baseURL, delivery),
    );
    const notifications = createNotificationWorker(database, delivery);
    app.use("/api", (_request, response) =>
      response.status(404).json({ error: "API route not found." }),
    );
    if (options.staticDir) {
      const staticDir = resolve(options.staticDir);
      app.use(
        express.static(staticDir, {
          index: false,
          setHeaders(response, filePath) {
            if (
              filePath.endsWith("index.html") ||
              filePath.endsWith("sw.js") ||
              filePath.endsWith("service-worker.js")
            ) {
              response.setHeader("Cache-Control", "no-cache");
            }
          },
        }),
      );
      app.get("/{*splat}", (request, response, next) => {
        if (!request.accepts("html") || request.path.split("/").at(-1)?.includes(".")) {
          next();
          return;
        }
        response.set("Cache-Control", "no-cache").sendFile("index.html", { root: staticDir });
      });
    }
    app.use(
      (
        error: unknown,
        _request: express.Request,
        response: express.Response,
        _next: express.NextFunction,
      ) => {
        if (
          typeof error === "object" &&
          error !== null &&
          "type" in error &&
          error.type === "entity.too.large"
        ) {
          response.status(413).json({ error: "Request body is too large." });
          return;
        }
        if (error instanceof SyntaxError) {
          response.status(400).json({ error: "Invalid request body." });
          return;
        }
        response.status(500).json({ error: "Internal server error." });
      },
    );
    if (options.notifications) notifications.start();
    return {
      app,
      close: () => {
        if (options.notifications)
          return notifications.stop().then(() => {
            database.close();
          });
        database.close();
      },
    };
  } catch (error) {
    database.close();
    throw error;
  }
}
