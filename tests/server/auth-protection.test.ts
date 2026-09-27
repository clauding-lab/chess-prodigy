// @vitest-environment node
import request from "supertest";
import { afterEach, expect, it } from "vitest";
import { createTestApplication } from "./http-fixture";

const origin = "http://chess.example.test";
const password = "correct horse battery staple";
const applications: Awaited<ReturnType<typeof createTestApplication>>[] = [];
afterEach(async () => {
  for (const app of applications.splice(0)) await app.close();
});
async function fixture() {
  const application = await createTestApplication({
    databasePath: ":memory:",
    baseURL: origin,
    secret: "test-secret-with-at-least-thirty-two-characters",
  });
  applications.push(application);
  const agent = request.agent(application.app);
  await agent
    .post("/api/auth/sign-up/email")
    .set("Origin", origin)
    .send({ name: "Original", email: "player@example.test", password })
    .expect(200);
  return { application, agent };
}
it.each(["https://evil.test", "http://sibling.example.test", undefined])(
  "rejects cookie mutations from %s even in the test environment",
  async (host) => {
    const { agent } = await fixture();
    for (const [route, body] of [
      ["update-user", { name: "Attacker" }],
      [
        "change-password",
        { currentPassword: password, newPassword: "a different secure password" },
      ],
      ["sign-out", {}],
    ] as const) {
      const call = agent.post(`/api/auth/${route}`);
      if (host) call.set("Origin", host);
      await call.send(body).expect(403);
    }
    const session = await agent.get("/api/auth/get-session").expect(200);
    expect(session.body.user.name).toBe("Original");
  },
);
it("allows same-origin account mutations and the same-origin Referer fallback", async () => {
  const { agent } = await fixture();
  await agent
    .post("/api/auth/update-user")
    .set("Origin", origin)
    .send({ name: "Updated" })
    .expect(200);
  await agent
    .post("/api/auth/change-password")
    .set("Referer", `${origin}/account`)
    .send({ currentPassword: password, newPassword: "a different secure password" })
    .expect(200);
  await agent.post("/api/auth/sign-out").set("Origin", origin).send({}).expect(200);
  const session = await agent.get("/api/auth/get-session").expect(200);
  expect(session.body).toBeNull();
});
it.each(["sign-in/email", "sign-up/email"])(
  "blocks cross-site navigation login CSRF at %s",
  async (route) => {
    const { application } = await fixture();
    await request(application.app)
      .post(`/api/auth/${route}`)
      .set("Origin", "https://evil.test")
      .set("Sec-Fetch-Site", "cross-site")
      .set("Sec-Fetch-Mode", "navigate")
      .send({ name: "Other", email: "other@example.test", password })
      .expect(403);
  },
);
it("documents the retained duplicate-registration distinction at the API boundary", async () => {
  const { application } = await fixture();
  const duplicate = await request(application.app)
    .post("/api/auth/sign-up/email")
    .set("Origin", origin)
    .send({ name: "Other", email: "player@example.test", password })
    .expect(422);
  expect(duplicate.body.code).toBe("USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL");
  await request(application.app)
    .post("/api/auth/sign-up/email")
    .set("Origin", origin)
    .send({ name: "New", email: "new@example.test", password })
    .expect(200);
});

it.each(["https://evil.test", "http://sibling.example.test"])(
  "rejects browser sign-in and registration from %s without cookies",
  async (host) => {
    const { application } = await fixture();
    for (const route of ["sign-in/email", "sign-up/email"]) {
      await request(application.app)
        .post(`/api/auth/${route}`)
        .set("Origin", host)
        .set("Sec-Fetch-Site", host.includes("sibling") ? "same-site" : "cross-site")
        .set("Sec-Fetch-Mode", "cors")
        .send({ name: "New", email: "player@example.test", password })
        .expect(403);
    }
  },
);
it("allows a fresh same-origin browser login with fetch metadata", async () => {
  const { application } = await fixture();
  await request(application.app)
    .post("/api/auth/sign-in/email")
    .set("Origin", origin)
    .set("Sec-Fetch-Site", "same-origin")
    .set("Sec-Fetch-Mode", "cors")
    .send({ email: "player@example.test", password })
    .expect(200);
});
