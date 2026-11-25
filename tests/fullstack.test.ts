import { beforeEach, expect, it, vi } from "vitest";
import { AuthError } from "@gorth-com/structure/modules/auth/server";
vi.mock("next/server", () => ({ after: vi.fn() }));

const fixture = vi.hoisted(() => ({
  credentials: vi.fn(),
  verify: vi.fn(),
  profile: vi.fn(),
  users: vi.fn(),
  current: vi.fn(),
  update: vi.fn(),
  forward: vi.fn(),
  sync: vi.fn(),
  logoutVerify: vi.fn(),
  logoutEnd: vi.fn(),
  member: vi.fn(),
}));
vi.mock("@/utils/environment", () => ({
  oauthCookiePrefix: "gorth",
  appUrl: "https://chat.example.test",
  oauthAudience: "https://chat-api.example.test",
  authUrl: "https://sso.example.test",
  oauthClientId: "chat",
  oauthClientSecret: "fixture-confidential-secret",
  sessionSecret: "fixture-only-session-key-at-least-32-bytes",
  sessionMaxAgeSeconds: "2592000",
  oauthNotifyAudience: "https://notify.example.test",
  oauthResourceAudience: "https://resource.example.test",
  oauthDiscoveryAudience: "https://discovery.example.test",
  oauthPaymentAudience: "https://payment.example.test",
  oauthBillingAudience: "https://billing.example.test",
  oauthMediaAudience: "https://media.example.test",
  oauthInsightAudience: "https://insight.example.test",
  oauthCommerceAudience: "",
  isProduction: true,
  rateLimitEnabled: false,
  databaseUrl: "",
  pgPoolMax: "5",
  sessionAppCookie: "gorth.session_token",
  accessTokenCookie: "gorth.access_token",
  refreshTokenCookie: "gorth.refresh_token",
  oauthStateCookie: "gorth.oauth_state",
  oauthCodeVerifierCookie: "gorth.oauth_code_verifier",
  oauthReturnToCookie: "gorth.oauth_return_to",
  oauthIssuerCookie: "gorth.oauth_issuer",
  oauthNonceCookie: "gorth.oauth_nonce",
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
  rawGetOAuthProtectedResourceMetadata: () => ({
    resource: "https://chat-api.example.test",
  }),
}));
vi.mock("@/models/user", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/models/user")>()),
  rawListUsers: fixture.users,
  rawGetCurrentUserRow: fixture.current,
  rawUpdateUser: fixture.update,
  rawSyncUser: fixture.sync,
}));
vi.mock("@/services/route", () => ({
  rawForwardRouteRequest: fixture.forward,
}));
vi.mock("@/models/conversation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/models/conversation")>()),
  rawChangeChatMember: fixture.member,
}));
vi.mock("@/lib/auth/server", () => ({
  authServer: { handler: () => new Response(null, { status: 404 }) },
}));
vi.mock("@/models/revocation", () => ({
  rawVerifyBackchannelLogoutToken: fixture.logoutVerify,
  rawEndSsoSessions: fixture.logoutEnd,
}));
import { Hono } from "hono";
import * as internalApi from "@/app/(api)/internal/[[...route]]/route";
import * as externalApi from "@/app/(api)/external/[[...route]]/route";
import { routeRequest } from "./http-app";
import { getAuthConfig } from "@/lib/auth/config";
import { createServiceError } from "@/utils/service";

const handle = "h".repeat(43);
const cookie = "gorth.session_token=" + handle;
const app = new Hono();
type Entry = Pick<
  typeof internalApi,
  "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS"
>;
const api: Entry = {
  GET: routeRequest,
  HEAD: routeRequest,
  POST: routeRequest,
  PUT: routeRequest,
  PATCH: routeRequest,
  DELETE: routeRequest,
  OPTIONS: routeRequest,
};
app.all("*", (context) =>
  api[context.req.method as keyof Entry](context.req.raw),
);
it("registers unprefixed domain APIs without owning chat navigation URLs", async () => {
  for (const path of ["/user", "/conversation", "/call/incoming"])
    expect((await app.request(path)).status).toBe(401);
  expect((await app.request("/chat/conversation")).status).toBe(404);
  expect((await app.request("/chat/fixture-id")).status).toBe(404);
});

it.each([
  "/user",
  "/conversation",
  "/conversation/11111111-1111-4111-8111-111111111111/message",
])(
  "mounts protected routers directly in the root catch-all: %s",
  async (path) => {
    const response = await api.GET(
      new Request("https://chat.example.test" + path),
    );
    expect(response.status).toBe(401);
  },
);

it("keeps a nested member ID separate from the conversation id", async () => {
  fixture.member.mockResolvedValue({ updated: true });
  const conversationId = "11111111-1111-4111-8111-111111111111";
  const userId = "22222222-2222-4222-8222-222222222222";
  const response = await api.PATCH(
    new Request(
      "https://chat.example.test/conversation/" +
        conversationId +
        "/member/" +
        userId,
      {
        method: "PATCH",
        headers: {
          Cookie: cookie,
          Origin: "https://chat.example.test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: "member" }),
      },
    ),
  );
  expect(response.status).toBe(200);
  expect(fixture.member).toHaveBeenCalledWith(
    conversationId,
    "local-user",
    userId,
    "role",
    "member",
  );
});
const account = {
  syncedAt: new Date(),
  id: "local-user",
  externalUserId: "sso-sub",
  email: "user@example.test",
  name: "User",
  username: null,
  image: null,
  status: "active",
  role: "user",
  bannedAt: null,
  deletedAt: null,
};
beforeEach(() => {
  Object.values(fixture).forEach((mock) => mock.mockReset());
  fixture.credentials.mockResolvedValue({
    subject: "sso-sub",
    user: account,
    expiresAt: Date.now() + 600000,
    credentials: {
      accessToken: "private-access",
      refreshToken: "private-refresh",
      accessExpiresAt: Date.now() + 300000,
    },
  });
  fixture.verify.mockResolvedValue({
    sub: "sso-sub",
    scope: "chat:read chat:write",
    sid: "sso-sid",
  });
  fixture.profile.mockResolvedValue({
    sub: "sso-sub",
    email: account.email,
    name: account.name,
    status: "active",
  });
  fixture.users.mockResolvedValue([]);
  fixture.current.mockResolvedValue(account);
  fixture.sync.mockResolvedValue(account);
  fixture.update.mockResolvedValue({ name: "Updated" });
  fixture.forward.mockResolvedValue(
    Response.json(
      { data: [] },
      { headers: { "Set-Cookie": "gorth.session_token=untrusted-upstream" } },
    ),
  );
});

it("health and anonymous APIs do not initialize DB or contact another Chat server", async () => {
  expect((await app.request("/health")).status).toBe(200);
  expect((await app.request("/user")).status).toBe(401);
  expect((await app.request("/conversation")).status).toBe(401);
  expect(fixture.credentials).not.toHaveBeenCalled();
  expect(fixture.forward).not.toHaveBeenCalled();
});

it("keeps domain payloads and requires the Chat token scopes", async () => {
  const response = await app.request("/user?limit=10", {
    headers: { Cookie: cookie },
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ data: [] });
  expect(fixture.users).toHaveBeenCalledWith(10);
  expect(fixture.verify).not.toHaveBeenCalled();
  expect(response.headers.get("cache-control")).toBe("no-store");
});

it("validates JSON with native Hono Context and preserves controller status codes", async () => {
  const request = (body: string) =>
    app.request("/user/local-user", {
      method: "PATCH",
      headers: {
        Cookie: cookie,
        Origin: "https://chat.example.test",
        "Content-Type": "application/json",
      },
      body,
    });
  const invalid = await request("{");
  expect(invalid.status).toBe(400);
  expect(await invalid.json()).toEqual({ error: "invalid_json" });
  expect(fixture.update).not.toHaveBeenCalled();
  const valid = await request(JSON.stringify({ name: "Updated" }));
  expect(valid.status).toBe(200);
  expect(fixture.update).toHaveBeenCalledWith(
    "local-user",
    expect.objectContaining({ name: "Updated" }),
  );
});

it("does not report downstream domain and DB errors as invalid access tokens", async () => {
  fixture.users.mockRejectedValue(createServiceError(404, "user_not_found"));
  const domain = await app.request("/user", {
    headers: { Cookie: cookie },
  });
  expect(domain.status).toBe(404);
  expect(await domain.json()).toEqual({ error: "user_not_found" });
  fixture.users.mockRejectedValue(new Error("private connection details"));
  const unavailable = await app.request("/user", {
    headers: { Cookie: cookie },
  });
  expect(unavailable.status).toBe(500);
  expect(await unavailable.json()).toEqual({ error: "internal_server_error" });
});

it("forwards only the access token to the owning platform and preserves app cookies", async () => {
  const response = await app.request("/notification?limit=3", {
    headers: { Cookie: cookie },
  });
  expect(response.status).toBe(200);
  const options = fixture.forward.mock.calls[0]![0];
  expect(options.url.href).toBe(
    "https://notify.example.test/notification?limit=3",
  );
  expect(options.headers.get("authorization")).toBe("Bearer private-access");
  expect(options.headers.has("cookie")).toBe(false);
  expect(options.headers.has("x-bff-signature")).toBe(false);
  expect(response.headers.getSetCookie()).toHaveLength(0);
  expect(response.headers.getSetCookie().join(";")).not.toContain(
    "untrusted-upstream",
  );
  expect(await response.text()).not.toContain("private-access");
});

it.each([
  "resource",
  "discovery",
  "notification",
  "payment",
  "billing",
  "media",
  "insight",
  "commerce",
])(
  "requires a native app session in the dedicated %s handler",
  async (domain) => {
    const response = await externalApi.GET(
      new Request("https://chat.example.test/external/" + domain + "/example"),
    );
    expect(response.status).toBe(401);
    expect(fixture.forward).not.toHaveBeenCalled();
  },
);

it.each([
  ["resource", "resource"],
  ["discovery", "discovery"],
  ["notification", "notify"],
  ["payment", "payment"],
  ["billing", "billing"],
  ["media", "media"],
  ["insight", "insight"],
])(
  "forwards %s body/query with only server-owned credentials",
  async (domain, host) => {
    const response = await externalApi.POST(
      new Request(
        "https://chat.example.test/external/" + domain + "/example?q=hello",
        {
          method: "POST",
          headers: {
            Cookie: cookie,
            Origin: "https://chat.example.test",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: "example" }),
        },
      ),
    );
    expect(response.status).toBe(200);
    const request = fixture.forward.mock.calls[0]![0];
    expect(request.url.href).toBe(
      "https://" + host + ".example.test/" + domain + "/example?q=hello",
    );
    expect(request.method).toBe("POST");
    expect(JSON.parse(new TextDecoder().decode(request.body))).toEqual({
      name: "example",
    });
    expect(request.headers.get("Authorization")).toBe("Bearer private-access");
    expect(request.headers.has("Cookie")).toBe(false);
  },
);

it("returns 503 for unconfigured Commerce without calling any upstream", async () => {
  const response = await externalApi.GET(
    new Request("https://chat.example.test/external/commerce/order", {
      headers: { Cookie: cookie },
    }),
  );
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "service_unavailable" });
  expect(fixture.forward).not.toHaveBeenCalled();
});

it("removes service forwarding from the generic catch-all", async () => {
  const response = await internalApi.GET(
    new Request("https://chat.example.test/internal/resource/example"),
  );
  expect(response.status).toBe(404);
  expect(fixture.forward).not.toHaveBeenCalled();
});

it("logout fences platform forwarding and cross-site mutations fail before session reads", async () => {
  fixture.credentials.mockResolvedValue(null);
  expect(
    (await app.request("/resource/item", { headers: { Cookie: cookie } }))
      .status,
  ).toBe(401);
  expect(fixture.forward).not.toHaveBeenCalled();
  fixture.credentials.mockClear();
  const denied = await app.request("/notification", {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: "https://evil.example.test",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  expect(denied.status).toBe(403);
  expect(fixture.credentials).not.toHaveBeenCalled();
});

it("distinguishes unknown endpoints and unsupported methods", async () => {
  expect((await app.request("/does-not-exist")).status).toBe(404);
  const response = await app.request("/auth/get-session", {
    method: "PUT",
    headers: { Origin: "https://chat.example.test" },
  });
  expect(response.status).toBe(405);
  expect(response.headers.get("allow")).toContain("POST");
});

it("keeps all seven configured service audiences separate from caller input", () => {
  expect(getAuthConfig().resources).toEqual([
    "https://chat-api.example.test",
    "https://notify.example.test",
    "https://resource.example.test",
    "https://discovery.example.test",
    "https://payment.example.test",
    "https://billing.example.test",
    "https://media.example.test",
    "https://insight.example.test",
  ]);
});

it("does not grant platform forwarding when the session store is unavailable", async () => {
  fixture.credentials.mockRejectedValue(new AuthError("unavailable"));
  const response = await app.request("/notification", {
    headers: { Cookie: cookie },
  });
  expect(response.status).toBe(503);
  expect(fixture.forward).not.toHaveBeenCalled();
  expect(response.headers.getSetCookie()).toHaveLength(0);
});

it.each([
  ["GET", "/conversation", api.GET, 401],
  ["POST", "/conversation", api.POST, 401],
  ["GET", "/conversation/11111111-1111-4111-8111-111111111111", api.GET, 401],
  [
    "PATCH",
    "/conversation/11111111-1111-4111-8111-111111111111",
    api.PATCH,
    401,
  ],
  [
    "DELETE",
    "/conversation/11111111-1111-4111-8111-111111111111",
    api.DELETE,
    401,
  ],
  [
    "GET",
    "/conversation/11111111-1111-4111-8111-111111111111/member",
    api.GET,
    401,
  ],
  [
    "POST",
    "/conversation/11111111-1111-4111-8111-111111111111/member",
    api.POST,
    401,
  ],
  [
    "PATCH",
    "/conversation/11111111-1111-4111-8111-111111111111/member/11111111-1111-4111-8111-111111111111",
    api.PATCH,
    401,
  ],
  [
    "DELETE",
    "/conversation/11111111-1111-4111-8111-111111111111/member/11111111-1111-4111-8111-111111111111",
    api.DELETE,
    401,
  ],
  [
    "PATCH",
    "/conversation/11111111-1111-4111-8111-111111111111/preference",
    api.PATCH,
    401,
  ],
  [
    "GET",
    "/conversation/11111111-1111-4111-8111-111111111111/message",
    api.GET,
    401,
  ],
  [
    "POST",
    "/conversation/11111111-1111-4111-8111-111111111111/message",
    api.POST,
    401,
  ],
  [
    "GET",
    "/conversation/11111111-1111-4111-8111-111111111111/event",
    api.GET,
    401,
  ],
  [
    "GET",
    "/conversation/11111111-1111-4111-8111-111111111111/search",
    api.GET,
    401,
  ],
  [
    "GET",
    "/conversation/11111111-1111-4111-8111-111111111111/delivery",
    api.GET,
    401,
  ],
  [
    "POST",
    "/conversation/11111111-1111-4111-8111-111111111111/delivery/11111111-1111-4111-8111-111111111111/retry",
    api.POST,
    401,
  ],
  [
    "POST",
    "/conversation/11111111-1111-4111-8111-111111111111/upload",
    api.POST,
    401,
  ],
  [
    "POST",
    "/conversation/11111111-1111-4111-8111-111111111111/upload/11111111-1111-4111-8111-111111111111/complete",
    api.POST,
    401,
  ],
  [
    "POST",
    "/conversation/11111111-1111-4111-8111-111111111111/upload/11111111-1111-4111-8111-111111111111/abort",
    api.POST,
    401,
  ],
  ["GET", "/message/11111111-1111-4111-8111-111111111111", api.GET, 401],
  ["PATCH", "/message/11111111-1111-4111-8111-111111111111", api.PATCH, 401],
  ["DELETE", "/message/11111111-1111-4111-8111-111111111111", api.DELETE, 401],
  [
    "POST",
    "/message/11111111-1111-4111-8111-111111111111/reaction",
    api.POST,
    401,
  ],
  [
    "DELETE",
    "/message/11111111-1111-4111-8111-111111111111/reaction",
    api.DELETE,
    401,
  ],
  [
    "POST",
    "/message/11111111-1111-4111-8111-111111111111/receipt",
    api.POST,
    401,
  ],
  [
    "POST",
    "/message/11111111-1111-4111-8111-111111111111/report",
    api.POST,
    401,
  ],
  [
    "GET",
    "/attachment/11111111-1111-4111-8111-111111111111/download",
    api.GET,
    401,
  ],
  ["POST", "/block/11111111-1111-4111-8111-111111111111", api.POST, 401],
  ["DELETE", "/block/11111111-1111-4111-8111-111111111111", api.DELETE, 401],
  [
    "GET",
    "/conversation/11111111-1111-4111-8111-111111111111/call",
    api.GET,
    401,
  ],
  [
    "POST",
    "/conversation/11111111-1111-4111-8111-111111111111/call",
    api.POST,
    401,
  ],
  ["GET", "/call/11111111-1111-4111-8111-111111111111/signal", api.GET, 401],
  ["POST", "/call/11111111-1111-4111-8111-111111111111/signal", api.POST, 401],
  ["GET", "/call/ice", api.GET, 401],
  ["GET", "/call/incoming", api.GET, 401],
  ["POST", "/event/dispatch", api.POST, 403],
  ["POST", "/internal/storage/credential", api.POST, 403],
  ["GET", "/user", api.GET, 401],
  ["POST", "/user", api.POST, 401],
  ["GET", "/user/me", api.GET, 401],
  ["GET", "/user/11111111-1111-4111-8111-111111111111", api.GET, 401],
  ["PATCH", "/user/11111111-1111-4111-8111-111111111111", api.PATCH, 401],
  ["DELETE", "/user/11111111-1111-4111-8111-111111111111", api.DELETE, 401],
  ["GET", "/socket/11111111-1111-4111-8111-111111111111/token", api.GET, 401],
] as const)(
  "rejects anonymous requests on the actual Next entry %s %s",
  async (method, path, handler, status) => {
    const response = await handler(
      new Request("https://chat.example.test" + path, {
        method,
        headers: {
          Origin: "https://chat.example.test",
          ...(method === "GET" ? {} : { "Content-Type": "application/json" }),
        },
        ...(method === "GET" ? {} : { body: "{}" }),
      }),
    );
    expect(response.status).toBe(status);
    expect(fixture.credentials).not.toHaveBeenCalled();
    expect(fixture.sync).not.toHaveBeenCalled();
  },
);

it("syncs the verified fresh identity at the full /auth/sync path", async () => {
  const response = await api.POST(
    new Request("https://chat.example.test/auth/sync", {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: "https://chat.example.test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: "attacker", role: "admin" }),
    }),
  );
  expect(response.status).toBe(200);
  expect(fixture.credentials).toHaveBeenCalledWith(expect.any(Headers), true);
  expect(fixture.sync).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      id: "sso-sub",
      email: account.email,
    }),
  );
});

it("rejects cross-origin sync before reading the session or writing a user", async () => {
  const response = await api.POST(
    new Request("https://chat.example.test/auth/sync", {
      method: "POST",
      headers: { Cookie: cookie, Origin: "https://attacker.example" },
    }),
  );
  expect(response.status).toBe(403);
  expect(fixture.credentials).not.toHaveBeenCalled();
  expect(fixture.sync).not.toHaveBeenCalled();
});

it("keeps sync as a POST-only operation", async () => {
  const response = await api.GET(
    new Request("https://chat.example.test/auth/sync"),
  );
  expect(response.status).toBe(405);
  expect(response.headers.get("allow")).toContain("POST");
  expect(fixture.sync).not.toHaveBeenCalled();
});

it("preserves signed backchannel verification without requiring a browser session", async () => {
  const marker = { subject: "sso-sub", sid: "central-session" };
  fixture.logoutVerify.mockResolvedValue(marker);
  const response = await api.POST(
    new Request("https://chat.example.test/auth/sign-out/back-channel", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ logout_token: "fixture-signed-token" }),
    }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(fixture.logoutVerify).toHaveBeenCalledExactlyOnceWith(
    "fixture-signed-token",
  );
  expect(fixture.logoutEnd).toHaveBeenCalledExactlyOnceWith(marker);
  expect(fixture.credentials).not.toHaveBeenCalled();
});

it.each([
  ["logout_token=one&logout_token=two", 400],
  ["logout_token=" + "x".repeat(33000), 413],
] as const)(
  "rejects malformed or oversized backchannel payloads before verification",
  async (body, status) => {
    const response = await api.POST(
      new Request("https://chat.example.test/auth/sign-out/back-channel", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      }),
    );
    expect(response.status).toBe(status);
    expect(fixture.logoutVerify).not.toHaveBeenCalled();
    expect(fixture.logoutEnd).not.toHaveBeenCalled();
  },
);

it("does not keep the obsolete backchannel endpoint active", async () => {
  const response = await api.POST(
    new Request("https://chat.example.test/auth/backchannel-logout", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ logout_token: "fixture-signed-token" }),
    }),
  );
  expect(response.status).toBe(404);
  expect(fixture.logoutVerify).not.toHaveBeenCalled();
  expect(fixture.logoutEnd).not.toHaveBeenCalled();
});

it("rejects invalid signatures at the new backchannel path", async () => {
  fixture.logoutVerify.mockRejectedValue(new AuthError("rejected"));
  const response = await api.POST(
    new Request("https://chat.example.test/auth/sign-out/back-channel", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ logout_token: "invalid-signature" }),
    }),
  );
  expect(response.status).toBe(400);
  expect(fixture.logoutEnd).not.toHaveBeenCalled();
});

it("uses native Hono path params instead of client identity headers", async () => {
  const request = new Request("https://chat.example.test/user/local-user", {
    method: "PATCH",
    headers: {
      Cookie: cookie,
      Origin: "https://chat.example.test",
      "Content-Type": "application/json",
      "x-user-id": "attacker",
    },
    body: JSON.stringify({ name: "Updated" }),
  });
  const response = await api.PATCH(request);
  expect(response.status).toBe(200);
  expect(fixture.update).toHaveBeenCalledWith("local-user", {
    name: "Updated",
  });
});

it("rejects updates to another user even with a valid session", async () => {
  const response = await api.PATCH(
    new Request("https://chat.example.test/user/another-user", {
      method: "PATCH",
      headers: {
        Cookie: cookie,
        Origin: "https://chat.example.test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Updated" }),
    }),
  );
  expect(response.status).toBe(403);
  expect(fixture.update).not.toHaveBeenCalled();
});
