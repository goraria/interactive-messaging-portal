import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { beforeEach, expect, it, vi } from "vitest";
const database = vi.hoisted(() => vi.fn());
const nativeHandler = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/server", async (original) => ({
  ...(await original<typeof import("@/lib/auth/server")>()),
  authServer: { handler: nativeHandler },
}));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/database", () => ({ getDatabase: database }));
vi.mock("@/utils/environment", async (original) => ({
  ...(await original<typeof import("@/utils/environment")>()),
  appUrl: "https://app.example.test",
  isProduction: false,
  rateLimitEnabled: false,
}));
import { GET, DELETE } from "@/app/(api)/internal/[[...route]]/route";
import { GET as authGET } from "@/app/(api)/auth/[[...route]]/route";
import { GET as syncGET, POST as syncPOST } from "@/app/(api)/auth/sync/route";
import { POST as backchannelPOST } from "@/app/(api)/auth/sign-out/back-channel/route";
import { GET as externalGET } from "@/app/(api)/external/[[...route]]/route";
beforeEach(() => {
  database.mockReset().mockImplementation(() => {
    throw new Error("Unexpected database access");
  });
});
it("serves health lazily through the Next HTTP adapter with private response headers", async () => {
  const response = await GET(new Request("https://app.example.test/internal/health"));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ status: "ok" });
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(database).not.toHaveBeenCalled();
});
it("preserves method restrictions and the Allow header", async () => {
  const response = await DELETE(
    new Request("https://app.example.test/internal/health", {
      method: "DELETE",
      headers: { Origin: "https://app.example.test" },
    }),
  );
  expect(response.status).toBe(405);
  expect(response.headers.get("allow")).toContain("GET");
});
it("keeps custom session synchronization protected by CSRF", async () => {
  const response = await syncPOST(
    new Request("https://app.example.test/auth/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "https://external.example.test",
        "Sec-Fetch-Site": "cross-site",
      },
      body: "field=value",
    }),
  );
  expect(response.status).toBe(403);
  expect(database).not.toHaveBeenCalled();
});
it("keeps the native OAuth callback request, redirect and cookies intact", async () => {
  const url =
    "https://app.example.test/auth/callback/gorth?code=fixture&state=fixture";
  nativeHandler.mockResolvedValueOnce(new Response(null, {
    status: 302,
    headers: {
      Location: "/",
      "Set-Cookie": "gorth.session_token=fixture; Path=/; HttpOnly",
    },
  }));
  const response = await authGET(new Request(url));
  expect(nativeHandler.mock.calls.at(-1)?.[0]?.url).toBe(url);
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe("/");
  expect(response.headers.getSetCookie()).toEqual([
    "gorth.session_token=fixture; Path=/; HttpOnly",
  ]);
});
it("accepts a backchannel POST without a browser cookie but still requires a logout token", async () => {
  const response = await backchannelPOST(
    new Request("https://app.example.test/auth/sign-out/back-channel", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "other=value",
    }),
  );
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "invalid_request" });
  expect(database).not.toHaveBeenCalled();
});
it("keeps the three namespaced handlers compatible with all existing page and API paths", () => {
  const paths = readdirSync("app", { recursive: true })
    .filter((path) => /(^|\/)(page\.tsx|route\.ts)$/.test(String(path)))
    .map(
      (path) =>
        "/" +
        String(path)
          .split("/")
          .slice(0, -1)
          .filter((part) => !part.startsWith("("))
          .join("/"),
    );
  const { getSortedRoutes } = createRequire(import.meta.url)(
    "next/dist/shared/lib/router/utils/sorted-routes",
  );
  expect(() => getSortedRoutes([...new Set(paths)])).not.toThrow();
  const source = readFileSync("app/(api)/internal/[[...route]]/route.ts", "utf8");
  expect(source).toContain("router.use(http)");
  expect(source).not.toContain("@/app/api");
});

it("keeps external service routes behind the application session", async () => {
  const response = await externalGET(new Request("https://app.example.test/external/resource/me/bookmark"));
  expect(response.status).toBe(401);
  expect(database).not.toHaveBeenCalled();
});

it("preserves the sync method contract on the dedicated route", async () => {
  const response = await syncGET(new Request("https://app.example.test/auth/sync"));
  expect(response.status).toBe(405);
  expect(response.headers.get("allow")).toBe("POST");
  expect(database).not.toHaveBeenCalled();
});
