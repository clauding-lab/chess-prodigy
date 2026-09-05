import Database from "better-sqlite3";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { getMigrations } from "better-auth/db/migration";

export interface AuthOptions {
  database: Database.Database;
  baseURL: string;
  secret: string;
}

function configuration({ database, baseURL, secret }: AuthOptions) {
  function boundedName(name: unknown): string {
    if (typeof name !== "string") {
      throw new APIError("BAD_REQUEST", { message: "Name must be between 1 and 80 characters." });
    }
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 80) {
      throw new APIError("BAD_REQUEST", { message: "Name must be between 1 and 80 characters." });
    }
    return trimmed;
  }
  return {
    database,
    baseURL,
    basePath: "/api/auth",
    secret,
    trustedOrigins: [new URL(baseURL).origin],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      requireEmailVerification: false,
    },
    user: {
      changeEmail: { enabled: false },
    },
    account: {
      accountLinking: {
        enabled: false,
        disableImplicitLinking: true,
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user: { name: string }) => {
            return { data: { ...user, name: boundedName(user.name) } };
          },
        },
        update: {
          before: async (user: { name?: string }) => {
            if (user.name === undefined) return;
            return { data: { ...user, name: boundedName(user.name) } };
          },
        },
      },
    },
    rateLimit: {
      enabled: true,
      storage: "database" as const,
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 300, max: 5 },
      },
    },
    advanced: {
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip"],
      },
      useSecureCookies: new URL(baseURL).protocol === "https:",
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax" as const,
        secure: new URL(baseURL).protocol === "https:",
      },
    },
  };
}

export async function createAuth(options: AuthOptions) {
  const config = configuration(options);
  const migrations = await getMigrations(config);
  await migrations.runMigrations();
  return betterAuth(config);
}

export type ChessAuth = Awaited<ReturnType<typeof createAuth>>;
