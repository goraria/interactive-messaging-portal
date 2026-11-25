import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/utils/environment", () => ({
  appUrl: "https://chat.test",
  authUrl: "https://sso.test",
  oauthAudience: "https://chat-audience.test",
  oauthNotifyAudience: "https://notify.test",
  oauthResourceAudience: "https://resource.test",
  oauthDiscoveryAudience: "https://discovery.test",
  oauthMediaAudience: "https://media.test",
  oauthInsightAudience: "https://insight.test",
  oauthCommerceAudience: "",
  oauthClientId: "existing-chat-confidential",
  oauthClientSecret: "fixture-only-client-secret",
  isProduction: true,
}));
vi.mock("@/utils/fetcher", () => ({ fetcher: state.request }));
beforeEach(() => {
  vi.resetModules();
  state.request.mockReset();
});
it("uses native client-credentials requests and reuses the same confidential identity per service", async () => {
  state.request.mockResolvedValue({
    status: 200,
    data: {
      access_token: "fixture-token",
      token_type: "Bearer",
      expires_in: 300,
    },
  });
  const { rawChatBackendToken: chatBackendToken } = await import("@/services/chat-platform");
  const [a, b] = await Promise.all([
    chatBackendToken("notification"),
    chatBackendToken("notification"),
  ]);
  expect(a).toBe(b);
  expect(state.request).toHaveBeenCalledTimes(1);
  const request = state.request.mock.calls[0]![0];
  const body = new URLSearchParams(String(request.body));
  expect(body.get("grant_type")).toBe("client_credentials");
  expect(body.has("client_id")).toBe(false);
  expect(body.has("client_secret")).toBe(false);
  expect(new Headers(request.headers).get("authorization")).toBe(
    "Basic " +
      Buffer.from(
        "existing-chat-confidential:fixture-only-client-secret",
      ).toString("base64"),
  );
  expect(body.get("resource")).toBe("https://notify.test");
  expect(body.get("scope")).toBe("chat:notification:publish");
  expect(request.redirect).toBe("error");
});
it("keeps the dispatcher logical audience distinct from the HTTP app URL", async () => {
  state.request.mockResolvedValue({
    status: 200,
    data: {
      access_token: "fixture-token",
      token_type: "Bearer",
      expires_in: 300,
    },
  });
  const { rawChatBackendToken: chatBackendToken } = await import("@/services/chat-platform");
  await chatBackendToken("chat");
  expect(
    new URLSearchParams(String(state.request.mock.calls[0]![0].body)).get(
      "resource",
    ),
  ).toBe("https://chat-audience.test");
});
it("does not attach backend identity to delegated user calls and prevents URL escape", async () => {
  state.request.mockResolvedValue({ status: 200, data: { id: "result" } });
  const { rawChatPlatformRequest: chatPlatformRequest } = await import("@/services/chat-platform");
  await chatPlatformRequest(
    "media",
    "/media/upload",
    "POST",
    {},
    "user-access-token",
  );
  expect(state.request.mock.calls[0]![0].headers.Authorization).toBe(
    "Bearer user-access-token",
  );
  await expect(
    chatPlatformRequest("media", "//attacker.test/path", "GET"),
  ).rejects.toMatchObject({ statusCode: 400 });
  await expect(
    chatPlatformRequest("media", "/media/../../auth/token", "GET"),
  ).rejects.toMatchObject({ statusCode: 400 });
});
it("fails closed for bad grant response and rejects browser calls to machine routes", async () => {
  state.request.mockResolvedValue({
    status: 200,
    data: { access_token: "x", token_type: "Bearer", expires_in: 3600 },
  });
  const { rawChatBackendToken: chatBackendToken, rawVerifyChatBackend: verifyChatBackend } =
    await import("@/services/chat-platform");
  await expect(chatBackendToken("media")).rejects.toMatchObject({
    statusCode: 503,
  });
  await expect(
    verifyChatBackend(
      new Request("https://chat.test/event/dispatch", {
        headers: { Cookie: "session=not-a-machine-grant" },
      }),
    ),
  ).rejects.toMatchObject({ statusCode: 403 });
});
