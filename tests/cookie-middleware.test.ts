import { beforeEach, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { APIError } from "better-auth";
import { createInsufficientScopeError } from "better-auth/oauth2";
import { AuthError } from "@gorth-com/structure/modules/auth/server";

const fixture = vi.hoisted(() => ({
  credentials: vi.fn(),
  verify: vi.fn(),
  profile: vi.fn(),
  local: vi.fn(),
}));
vi.mock("@/utils/environment", () => ({
  oauthCookiePrefix: "gorth",
  appUrl: "https://chat.example.test",
  oauthAudience: "https://chat-api.example.test",
  authUrl: "https://sso.example.test",
  oauthClientId: "chat",
  oauthClientSecret: "fixture-confidential-secret",
  sessionSecret: "fixture-only-session-key-at-least-32-bytes",
  oauthNotifyAudience: "",
  oauthResourceAudience: "",
  oauthDiscoveryAudience: "",
  oauthPaymentAudience: "",
  oauthBillingAudience: "",
  oauthMediaAudience: "",
  oauthInsightAudience: "",
  oauthCommerceAudience: "",
  isProduction: true,
  sessionAppCookie: "gorth.session_token",
  accessTokenCookie: "gorth.access_token",
  refreshTokenCookie: "gorth.refresh_token",
  oauthReadScope: "chat:read",
  oauthWriteScope: "chat:write",
}));
vi.mock("@/models/session", () => ({
  rawReadAppIdentity: fixture.credentials,
  rawReadAuthenticatedIdentity: fixture.credentials,
  rawReadAppCredentials: fixture.credentials,
}));
vi.mock("@/services/sso", () => ({
  rawVerifySsoAccessTokenRequest: fixture.verify,
  rawGetVerifiedSsoUserInfo: fixture.profile,
}));
vi.mock("@/models/user", () => ({
  rawFindUserByExternalId: fixture.local,
}));
import { requireAuth } from "@/middlewares/auth";
import { requireAppSession } from "@/middlewares/session";

const routes = new Hono();
routes.get("/private", requireAuth(), (context) =>
  context.json(context.get("auth")),
);
routes.post("/private", requireAuth(), (context) =>
  context.json(context.get("auth")),
);
const app = new Hono().route("/", routes);
app.get("/forward", requireAppSession(), (context) =>
  context.json({ authenticated: Boolean(context.get("credentials")) }),
);
app.get(
  "/scoped",
  requireAuth({ requiredBearerScopes: ["chat:write"] }),
  (context) => context.json(context.get("auth")),
);
app.get("/fresh", requireAuth({ freshProfile: true }), (context) =>
  context.json(context.get("auth")),
);
app.get("/domain-failure", requireAuth(), () => {
  throw new Error("domain failure");
});
app.onError(() => Response.json({ error: "domain_failed" }, { status: 409 }));
const handle = "a".repeat(43);
const cookie =
  "gorth.session_token=" + handle + "; gorth.access_token=untrusted-cookie";
const account = () => ({
  syncedAt: new Date(),
  id: "local-uuid",
  externalUserId: "sso-sub",
  name: "User",
  email: "user@example.test",
  username: null,
  image: null,
  status: "active",
  role: "local-admin",
  bannedAt: null,
  deletedAt: null,
});
const session = () => ({
  subject: "sso-sub",
  user: account(),
  expiresAt: Date.now() + 600_000,
  credentials: {
    accessToken: "db-access-token",
    refreshToken: "db-refresh",
    accessExpiresAt: Date.now() + 300_000,
  },
});
beforeEach(() => {
  for (const mock of Object.values(fixture)) mock.mockReset();
  fixture.credentials.mockResolvedValue(session());
  fixture.verify.mockResolvedValue({
    sub: "sso-sub",
    sid: "central-sid",
    scope: "chat:read chat:write",
  });
  fixture.profile.mockResolvedValue({
    sub: "sso-sub",
    name: "User",
    email: "user@example.test",
    status: "active",
  });
  fixture.local.mockResolvedValue(account());
});

it("uses the native app session without token verification and reuses its local user projection", async () => {
  const response = await app.request("/private", {
    headers: { Cookie: cookie },
  });
  expect(response.status).toBe(200);
  expect(fixture.credentials).toHaveBeenCalledExactlyOnceWith(
    expect.any(Headers),
    false,
  );
  expect(fixture.verify).not.toHaveBeenCalled();
  expect(fixture.local).not.toHaveBeenCalled();
  expect(await response.json()).toMatchObject({
    user: { id: "sso-sub" },
    localRole: "local-admin",
  });
  expect(response.headers.getSetCookie()).toHaveLength(0);
});

it("checks Origin before cookie-authenticated writes without requiring an OAuth token", async () => {
  for (const origin of [undefined, "https://evil.example.test"])
    expect(
      (
        await app.request("/private", {
          method: "POST",
          headers: { Cookie: cookie, ...(origin ? { Origin: origin } : {}) },
        })
      ).status,
    ).toBe(403);
  expect(fixture.credentials).not.toHaveBeenCalled();
  const response = await app.request("/private", {
    method: "POST",
    headers: { Cookie: cookie, Origin: "https://chat.example.test" },
  });
  expect(response.status).toBe(200);
  expect(fixture.credentials).toHaveBeenCalledExactlyOnceWith(
    expect.any(Headers),
    false,
  );
  expect(fixture.verify).not.toHaveBeenCalled();
});

it("a standalone access-token cookie cannot bypass local app logout", async () => {
  fixture.credentials.mockResolvedValue(null);
  expect(
    (await app.request("/private", { headers: { Cookie: cookie } })).status,
  ).toBe(401);
  expect(
    (
      await app.request("/private", {
        headers: { Cookie: "gorth.access_token=old-token" },
      })
    ).status,
  ).toBe(401);
  expect(fixture.verify).not.toHaveBeenCalled();
});

it("rejects cross-site cookie reads before consulting the session store", async () => {
  const response = await app.request("/private", {
    headers: { Cookie: cookie, Origin: "https://evil.example.test" },
  });
  expect(response.status).toBe(403);
  expect(fixture.credentials).not.toHaveBeenCalled();
});

it("external bearer APIs remain independent of user app cookies", async () => {
  const response = await app.request("/private", {
    method: "POST",
    headers: { Authorization: "Bearer external-service-token" },
  });
  expect(response.status).toBe(200);
  expect(fixture.credentials).not.toHaveBeenCalled();
  expect(fixture.verify).toHaveBeenCalledWith(
    expect.any(Request),
    ["chat:write"],
    "external-service-token",
    expect.objectContaining({}),
  );
  expect(fixture.local).toHaveBeenCalledWith("sso-sub");
});

it("keeps durable revocation rejection on native cookie requests", async () => {
  fixture.credentials.mockRejectedValue(new AuthError("forbidden"));
  expect(
    (await app.request("/private", { headers: { Cookie: cookie } })).status,
  ).toBe(403);
  expect(fixture.profile).not.toHaveBeenCalled();
});

it("keeps the session service's account policy rejection and backend failures", async () => {
  fixture.credentials.mockRejectedValue(new AuthError("forbidden"));
  expect(
    (await app.request("/private", { headers: { Cookie: cookie } })).status,
  ).toBe(403);
  fixture.credentials.mockRejectedValue(new AuthError("unavailable"));
  expect(
    (await app.request("/private", { headers: { Cookie: cookie } })).status,
  ).toBe(503);
});
it("does not interpret native sessions as OAuth access tokens", async () => {
  fixture.verify.mockRejectedValue(new Error("expired legacy access token"));
  fixture.profile.mockRejectedValue(new Error("SSO is offline"));
  const response = await app.request("/private", {
    headers: { Cookie: cookie },
  });
  expect(response.status).toBe(200);
  expect(fixture.verify).not.toHaveBeenCalled();
  expect(fixture.profile).not.toHaveBeenCalled();
  expect(await response.json()).toMatchObject({ verifiedBy: "better-auth" });
});

it("reports infrastructure failures as unavailable instead of invalid access tokens", async () => {
  fixture.credentials.mockRejectedValue(new Error("DB connection failed"));
  const response = await app.request("/private", {
    headers: { Cookie: cookie },
  });
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "auth_unavailable" });
});
it("delegates identity freshness to the session service", async () => {
  fixture.credentials.mockResolvedValue({
    ...session(),
    user: { ...account(), syncedAt: new Date(Date.now() - 120_001) },
  });
  expect(
    (await app.request("/private", { headers: { Cookie: cookie } })).status,
  ).toBe(200);
  expect(fixture.credentials).toHaveBeenCalledExactlyOnceWith(
    expect.any(Headers),
    false,
  );
  expect(fixture.verify).not.toHaveBeenCalled();
});

it.each([
  ["permanent", null, 403],
  ["current", new Date(Date.now() + 60_000), 403],
  ["expired", new Date(Date.now() - 60_000), 200],
] as const)(
  "applies the %s local ban policy to Bearer requests",
  async (_label, banExpires, status) => {
    fixture.local.mockResolvedValue({
      ...account(),
      bannedAt: new Date(Date.now() - 120_000),
      banExpires,
    });
    const response = await app.request("/private", {
      headers: { Authorization: "Bearer external-service-token" },
    });
    expect(response.status).toBe(status);
  },
);

it("does not fall back to a valid cookie when Authorization is malformed", async () => {
  const response = await app.request("/private", {
    headers: { Cookie: cookie, Authorization: "Basic invalid" },
  });
  expect(response.status).toBe(401);
  expect(fixture.credentials).not.toHaveBeenCalled();
  expect(fixture.verify).not.toHaveBeenCalled();
});

it("enforces explicit Bearer scopes and preserves the native challenge", async () => {
  fixture.verify.mockRejectedValue(
    createInsufficientScopeError(["chat:write"]),
  );
  const response = await app.request("/scoped", {
    headers: { Authorization: "Bearer external-service-token" },
  });
  expect(fixture.verify).toHaveBeenCalledWith(
    expect.any(Request),
    ["chat:write"],
    "external-service-token",
    expect.any(Object),
  );
  expect(response.status).toBe(403);
  expect(response.headers.get("WWW-Authenticate")).toBe(
    'Bearer error="insufficient_scope", scope="chat:write"',
  );
  expect(await response.json()).toEqual({
    error: "insufficient_scope",
    scope: "chat:write",
  });
});

it("keeps scope checks separate from native session and local role permissions", async () => {
  const response = await app.request("/scoped", {
    headers: { Cookie: cookie },
  });
  expect(response.status).toBe(200);
  expect(fixture.verify).not.toHaveBeenCalled();
  expect(await response.json()).toMatchObject({
    scopes: [],
    localRole: "local-admin",
  });
});

it("requests fresh SSO validation explicitly without reading the session twice", async () => {
  expect(
    (await app.request("/fresh", { headers: { Cookie: cookie } })).status,
  ).toBe(200);
  expect(fixture.credentials).toHaveBeenCalledExactlyOnceWith(
    expect.any(Headers),
    true,
  );
});

it("leaves downstream domain errors outside authentication error handling", async () => {
  const response = await app.request("/domain-failure", {
    headers: { Cookie: cookie },
  });
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: "domain_failed" });
});

it.each([
  [new AuthError("forbidden"), 403, "user_not_active"],
  [new AuthError("rejected"), 401, "invalid_session"],
  [new AuthError("unavailable"), 503, "auth_unavailable"],
  [new APIError("UNAUTHORIZED"), 401, "unauthorized"],
  [
    Object.assign(new Error("private details"), { code: "ERR_JWT_EXPIRED" }),
    401,
    "invalid_access_token",
  ],
  [new Error("private DB details"), 503, "auth_unavailable"],
] as const)(
  "preserves platform-session error contracts: %s",
  async (error, status, code) => {
    fixture.credentials.mockRejectedValue(error);
    const response = await app.request("/forward", {
      headers: { Cookie: cookie },
    });
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: code });
  },
);
