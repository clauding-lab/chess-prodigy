// @vitest-environment node
import express from "express";
import request from "supertest";
import { expect, it } from "vitest";
import { listenForTest } from "./http-fixture";
it("binds the same IPv4 loopback address used by the HTTP test client", async () => {
  const app = express();
  app.get("/", (_request, response) => response.json({ fixture: "owned" }));
  const server = await listenForTest(app);
  expect(server.address()).toMatchObject({ address: "127.0.0.1", family: "IPv4" });
  await request(server).get("/").expect(200, { fixture: "owned" });
});
