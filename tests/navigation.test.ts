import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const environment = vi.hoisted(() => ({ vercelDeployment: false }));
vi.mock("@/utils/environment", () => ({
  get vercelDeployment() {
    return environment.vercelDeployment;
  },
  oauthCookiePrefix: "gorth",
  oauthClientId: "chat",
  oauthClientSecret: "fixture-confidential-secret",
  appUrl: "http://localhost:3030",
  websocketPort: 3030,
}));
import { proxy } from "@/proxy";

afterEach(() => {
  environment.vercelDeployment = false;
  vi.restoreAllMocks();
});

it.each(["/external/socket/room-id/call", "/external/socket/room-id/chat"])(
  "forwards only socket path %s to the existing Hono listener",
  (path) => {
    const response = proxy(new NextRequest("http://localhost:3030" + path));
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://127.0.0.1:3037" + path,
    );
  },
);

it.each(["/external/socket/room-id/call", "/external/socket/room-id/chat"])(
  "keeps Vercel socket %s on its authenticated Route Handler",
  (path) => {
    environment.vercelDeployment = true;
    const response = proxy(new NextRequest("https://chat.vercel.app" + path));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.has("x-middleware-rewrite")).toBe(false);
  },
);

it("never self-fetches auth/me or redirects home based on a stale handle", () => {
  const network = vi.spyOn(globalThis, "fetch");
  for (const path of ["/", "/chat", "/chat/room-name"]) {
    const request = new NextRequest("https://chat.example.test" + path, {
      headers: {
        Accept: "text/html",
        Cookie: "gorth.session_token=" + "a".repeat(43),
      },
    });
    expect(proxy(request).headers.get("x-middleware-next")).toBe("1");
  }
  expect(network).not.toHaveBeenCalled();
});

it("redirects missing native session cookies without a network request", () => {
  for (const cookie of [""]) {
    const request = new NextRequest("https://chat.example.test/chat", {
      headers: { Accept: "text/html", Cookie: cookie },
    });
    expect(proxy(request).headers.get("location")).toBe(
      "https://chat.example.test/",
    );
  }
});

it.each(["application/json", "text/html"])(
  "leaves API requests (%s) to Hono rather than HTML redirects",
  (accept) => {
    for (const path of ["/auth/get-session", "/user", "/resource/item"]) {
      const request = new NextRequest("https://chat.example.test" + path, {
        headers: { Accept: accept, rsc: "1" },
      });
      expect(proxy(request).headers.get("x-middleware-next")).toBe("1");
    }
  },
);
