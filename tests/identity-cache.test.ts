import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  exportJWK,
  generateKeyPair,
  SignJWT,
} from "@gorth-com/structure/cores/jose";

const fixture = vi.hoisted(() => ({
  fetcher: vi.fn(),
  revoked: false,
  revocation: vi.fn(),
  discovery: vi.fn(),
}));
vi.mock("@/utils/environment", () => ({
  oauthCookiePrefix: "gorth",
  authUrl: "https://sso.example.test",
  oauthAudience: "https://chat-api.example.test",
  oauthReadScope: "chat:read",
  oauthWriteScope: "chat:write",
  isProduction: true,
}));
vi.mock("@gorth-com/structure/modules/http", () => ({
  createFetcher: () => fixture.fetcher,
}));
vi.mock("@/models/revocation", () => ({
  rawIsSsoSessionRevoked: fixture.revocation,
}));
vi.mock("@/lib/auth/dpop-replay-store", () => ({
  databaseDpopReplayStore: { reserve: async () => true },
}));

beforeEach(() => {
  vi.resetModules();
  fixture.fetcher.mockReset();
  fixture.fetcher.mockResolvedValue({
    status: 200,
    data: { sub: "sso-subject", status: "active", email: "user@example.test" },
  });
  fixture.revoked = false;
  fixture.discovery.mockReset().mockResolvedValue({
    issuer: "https://sso.example.test/auth",
    jwks_uri: "https://sso.example.test/auth/jwks",
  });
  fixture.revocation.mockReset();
  fixture.revocation.mockImplementation(async () => fixture.revoked);
});
afterEach(() => vi.restoreAllMocks());

it("coalesces concurrent identity reads, expires at 120 seconds, and isolates tokens", async () => {
  let now = Date.now();
  vi.spyOn(Date, "now").mockImplementation(() => now);
  const { rawGetSsoUserInfo: getSsoUserInfo } =
    await import("@/services/sso-userinfo");
  const reads = await Promise.all(
    Array.from({ length: 10 }, () => getSsoUserInfo("fixture-token")),
  );
  expect(reads.every((profile) => profile.sub === "sso-subject")).toBe(true);
  expect(fixture.fetcher).toHaveBeenCalledTimes(1);
  now += 119_999;
  await getSsoUserInfo("fixture-token");
  expect(fixture.fetcher).toHaveBeenCalledTimes(1);
  now += 1;
  await getSsoUserInfo("fixture-token");
  expect(fixture.fetcher).toHaveBeenCalledTimes(2);
  await getSsoUserInfo("another-token");
  expect(fixture.fetcher).toHaveBeenCalledTimes(3);
  await getSsoUserInfo("fixture-token", { fresh: true });
  expect(fixture.fetcher).toHaveBeenCalledTimes(4);
});

it.each([401, 503, "network", "malformed", "suspended"])(
  "does not reuse stale identity after a forced %s failure",
  async (failure) => {
    const { rawGetSsoUserInfo: getSsoUserInfo } =
      await import("@/services/sso-userinfo");
    await getSsoUserInfo("fixture-token");
    if (failure === "network")
      fixture.fetcher.mockRejectedValue(new Error("offline"));
    else
      fixture.fetcher.mockResolvedValue({
        status: typeof failure === "number" ? failure : 200,
        data:
          failure === "malformed"
            ? {}
            : {
                sub: "sso-subject",
                status: failure === "suspended" ? "suspended" : "active",
              },
      });
    await expect(
      getSsoUserInfo("fixture-token", { fresh: true }),
    ).rejects.toBeDefined();
    await expect(getSsoUserInfo("fixture-token")).rejects.toBeDefined();
    expect(fixture.fetcher).toHaveBeenCalledTimes(3);
  },
);

it("invalidates cached identities on grant revoke and fences an in-flight response", async () => {
  const {
    rawGetSsoUserInfo: getSsoUserInfo,
    rawForgetSsoUserInfo: forgetSsoUserInfo,
  } = await import("@/services/sso-userinfo");
  await getSsoUserInfo("fixture-token");
  await forgetSsoUserInfo("fixture-token");
  await getSsoUserInfo("fixture-token");
  expect(fixture.fetcher).toHaveBeenCalledTimes(2);
  await forgetSsoUserInfo("fixture-token");
  let release!: (value: unknown) => void;
  fixture.fetcher.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const pending = getSsoUserInfo("fixture-token").catch(
    (error: unknown) => error,
  );
  await vi.waitFor(() => expect(fixture.fetcher).toHaveBeenCalledTimes(3));
  await forgetSsoUserInfo("fixture-token");
  release({ status: 200, data: { sub: "sso-subject", status: "active" } });
  expect(await pending).toMatchObject({ code: "rejected" });
  await getSsoUserInfo("fixture-token");
  expect(fixture.fetcher).toHaveBeenCalledTimes(4);
});

it("still verifies JWT audience/scopes and persistent revocation on cached API reads", async () => {
  const issuer = "https://sso.example.test/auth";
  const audience = "https://chat-api.example.test";
  const keys = await generateKeyPair("RS256");
  const jwk = {
    ...(await exportJWK(keys.publicKey)),
    kid: "cache-fixture",
    alg: "RS256",
  };
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) =>
    String(url).includes("openid-configuration")
      ? Response.json({ issuer, jwks_uri: issuer + "/jwks" })
      : Response.json({ keys: [jwk] }),
  );
  const { rawVerifySsoAccessTokenRequest: verifySsoAccessTokenRequest } =
    await import("@/services/sso");
  const token = (
    aud = audience,
    scope = "chat:read chat:write",
    expires = "5m",
  ) =>
    new SignJWT({ sid: "central-sid", scope })
      .setProtectedHeader({ alg: "RS256", kid: jwk.kid, typ: "at+jwt" })
      .setIssuer(issuer)
      .setAudience(aud)
      .setSubject("sso-subject")
      .setIssuedAt()
      .setExpirationTime(expires)
      .sign(keys.privateKey);
  const accessToken = await token();
  const request = (method = "GET") =>
    new Request(audience + "/user", {
      method,
      headers: { Authorization: "Bearer " + accessToken },
    });
  await verifySsoAccessTokenRequest(request(), ["chat:read"]);
  await verifySsoAccessTokenRequest(request(), ["chat:read"]);
  expect(fixture.fetcher).toHaveBeenCalledTimes(1);
  expect(fixture.revocation).toHaveBeenCalledTimes(2);
  await verifySsoAccessTokenRequest(request("POST"), ["chat:write"]);
  await verifySsoAccessTokenRequest(request(), ["chat:read"], undefined, {
    freshProfile: true,
  });
  expect(fixture.fetcher).toHaveBeenCalledTimes(3);
  for (const invalid of [
    await token("wrong-audience"),
    await token(audience, "other:read"),
    await token(audience, "chat:read", "-10s"),
  ]) {
    await expect(
      verifySsoAccessTokenRequest(
        new Request(audience + "/user", {
          headers: { Authorization: "Bearer " + invalid },
        }),
        ["chat:read"],
      ),
    ).rejects.toBeDefined();
  }
  expect(fixture.fetcher).toHaveBeenCalledTimes(3);
  fixture.revoked = true;
  await expect(
    verifySsoAccessTokenRequest(request(), ["chat:read"]),
  ).rejects.toMatchObject({ code: "rejected" });
  expect(fixture.fetcher).toHaveBeenCalledTimes(3);
});

it("uses the authoritative Hono session identity without a second UserInfo call on writes", async () => {
  const keys = await generateKeyPair("RS256");
  const issuer = "https://sso.example.test/auth";
  const audience = "https://chat-api.example.test";
  const jwk = {
    ...(await exportJWK(keys.publicKey)),
    kid: "session-fixture",
    alg: "RS256",
  };
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ keys: [jwk] }),
  );
  const token = await new SignJWT({ sid: "central-sid", scope: "chat:write" })
    .setProtectedHeader({ alg: "RS256", kid: jwk.kid, typ: "at+jwt" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject("sso-subject")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(keys.privateKey);
  const request = new Request(audience + "/message", { method: "POST" });
  const session = {
    id: "native-session",
    sid: "central-sid",
    createdAt: Date.now(),
    subject: "sso-subject",
    expiresAt: Date.now() + 600_000,
    user: {
      id: "local-uuid",
      externalUserId: "sso-subject",
      name: "User",
      email: "user@example.test",
      username: null,
      image: null,
      role: "user",
      status: "active" as const,
      bannedAt: null,
      deletedAt: null,
    },
    credentials: {
      subject: "sso-subject",
      nonce: "n".repeat(43),
      accessToken: token,
      accessExpiresAt: Date.now() + 300_000,
    },
  };
  const {
    rawVerifySsoAccessTokenRequest: verifySsoAccessTokenRequest,
    rawGetVerifiedSsoUserInfo: getVerifiedSsoUserInfo,
  } = await import("@/services/sso");
  expect(
    (
      await verifySsoAccessTokenRequest(request, ["chat:write"], token, {
        session,
      })
    ).sub,
  ).toBe("sso-subject");
  expect(await getVerifiedSsoUserInfo(request, token)).toMatchObject({
    sub: "sso-subject",
    email: "user@example.test",
  });
  expect(fixture.fetcher).not.toHaveBeenCalled();
  expect(fixture.discovery).not.toHaveBeenCalled();
  expect(fixture.revocation).toHaveBeenCalledOnce();
  await expect(
    verifySsoAccessTokenRequest(request, ["chat:write"], token, {
      session: { ...session, subject: "other-user" },
    }),
  ).rejects.toMatchObject({ code: "rejected" });
  expect(fixture.fetcher).not.toHaveBeenCalled();
});
