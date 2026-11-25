import { Hono } from "hono";
import { beforeEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ identity: vi.fn() }));
vi.mock("@/models/session", () => ({ rawReadAppIdentity: fixture.identity }));
import { actHome } from "@/controllers/home";
const app = new Hono().get("/", actHome);
beforeEach(() => {
  fixture.identity.mockReset().mockResolvedValue(null);
});
it("serves a complete Hono HTML document and links into existing Next auth pages", async () => {
  const response = await app.request("/");
  const body = await response.text();
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/html");
  expect(body).toMatch(/^<!doctype html>/);
  expect(body).toContain("Conversations that stay out of");
  expect(body).toContain('href="/auth/sign-in"');
  expect(body).toContain('href="/auth/sign-up"');
  expect(body).toContain('href="/chat-landing.css"');
  expect(body).not.toContain("<script");
});
it("redirects only a verified local identity to the inbox", async () => {
  fixture.identity.mockResolvedValueOnce({ id: "verified-session" });
  const response = await app.request("/", {
    headers: { Cookie: "session=fixture" },
  });
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe("/chat");
  expect(fixture.identity.mock.calls[0]?.[0].get("cookie")).toBe(
    "session=fixture",
  );
});
it("does not treat a cookie alone as an authenticated identity", async () => {
  const response = await app.request("/", {
    headers: { Cookie: "session=invalid" },
  });
  expect(response.status).toBe(200);
  expect(response.headers.has("location")).toBe(false);
});
it("fails safely when identity verification is unavailable", async () => {
  fixture.identity.mockRejectedValueOnce(new Error("private provider details"));
  const response = await app.request("/");
  expect(response.status).toBe(503);
  const body = await response.text();
  expect(body).toContain("Temporarily unavailable");
  expect(body).not.toContain("private provider details");
});
