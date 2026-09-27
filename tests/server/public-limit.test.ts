// @vitest-environment node
import express from "express";
import request from "supertest";
import { expect, it } from "vitest";
import { createPublicReadLimit, publicClientKey } from "../../server/public-limit";

it("ignores forwarded identity unless an explicitly trusted local tunnel supplies a valid IP", () => {
  expect(publicClientKey("198.51.100.2", "203.0.113.1", true)).toBe("198.51.100.2");
  expect(publicClientKey("127.0.0.1", "203.0.113.1", false)).toBe("127.0.0.1");
  expect(publicClientKey("::ffff:127.0.0.1", "203.0.113.1", true)).toBe("203.0.113.1");
  expect(publicClientKey("::1", "spoof, 203.0.113.1", true)).toBe("::1");
});

it("limits visitors independently across both public boards and resets bounded state", async () => {
  let now = 1000;
  const app = express();
  const limit = createPublicReadLimit({ trustedLocalTunnel: true, now: () => now });
  app.get(["/practice", "/human"], limit, (_req, res) => res.json({ players: [] }));
  for (let i = 0; i < 60; i++)
    await request(app)
      .get(i % 2 ? "/human" : "/practice")
      .set("CF-Connecting-IP", "203.0.113.1")
      .expect(200);
  const blocked = await request(app)
    .get("/practice")
    .set("CF-Connecting-IP", "203.0.113.1")
    .expect(429);
  expect(blocked.headers["retry-after"]).toBe("59");
  await request(app).get("/practice").set("CF-Connecting-IP", "203.0.113.2").expect(200);
  now = 60000;
  await request(app).get("/practice").set("CF-Connecting-IP", "203.0.113.1").expect(200);
});
