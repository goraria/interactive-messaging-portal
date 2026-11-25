import { access, readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = fileURLToPath(new URL("../", import.meta.url));
async function sources(directory: string): Promise<string[]> {
  const entries = await readdir(root + directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory())
      files.push(...(await sources(directory + "/" + entry.name)));
    else if (/\.(ts|tsx)$/.test(entry.name))
      files.push(directory + "/" + entry.name);
  }
  return files;
}

it("composes domain routers in namespaced Next handlers", async () => {
  const namespaces = ["auth", "internal", "external"];
  const source = (
    await Promise.all(
      namespaces.map((namespace) =>
        readFile(
          root + "app/(api)/" + namespace + "/[[...route]]/route.ts",
          "utf8",
        ),
      ),
    )
  ).join("\n");
  expect(source).toContain("router.use(http)");
  expect(source).toContain("router.onError(httpError)");
  expect(source).toContain("router.notFound(httpNotFound)");
  for (const name of [
    "authRoutes",
    "usersRoutes",
    "conversationRoutes",
    "messageRoutes",
    "attachmentRoutes",
    "blockRoutes",
    "callRoutes",
    "eventRoutes",
    "socketRoutes",
    "labRoutes",
    "internalRoutes",
    "sharedRoutes",
  ])
    expect(source).toContain(", " + name + ")");
  expect(source).not.toMatch(/Routes\(\)/);
  expect(source).not.toContain("demoRoutes");
  for (const file of await sources("routes")) {
    const content = await readFile(root + file, "utf8");
    expect(content, file).not.toContain("export default");
    expect(content, file).not.toMatch(/export function \w+Routes\(/);
  }
  const entries = (await sources("app/(api)")).filter((file) =>
    file.endsWith("/route.ts"),
  );
  expect(entries.sort()).toEqual(
    [
      ...namespaces.map(
        (namespace) => "app/(api)/" + namespace + "/[[...route]]/route.ts",
      ),
      "app/(api)/auth/sync/route.ts",
      "app/(api)/auth/sign-out/back-channel/route.ts",
      "app/(api)/background/delivery/route.ts",
      "app/(api)/background/recover/route.ts",
      "app/(api)/.well-known/oauth-protected-resource/route.ts",
      "app/(api)/event/dispatch/route.ts",
      "app/(api)/health/route.ts",
      "app/(api)/internal/storage/credential/route.ts",
    ].sort(),
  );
  for (const obsolete of [
    "app/api.ts",
    "routes/index.ts",
    "controllers/route.ts",
    "lib/next-route.ts",
    "routes/demo.ts",
    "routes/chat.ts",
    "routes/backchannel.ts",
    "routes/platform.ts",
  ])
    await expect(access(root + obsolete)).rejects.toMatchObject({
      code: "ENOENT",
    });
});

it("keeps auth pages in their own route group without changing their URL segments", async () => {
  const apiSources = await sources("app/(api)");
  expect(apiSources.filter((path) => path.endsWith("/page.tsx"))).toEqual([]);
  for (const page of [
    "change-password",
    "error",
    "forgot-password",
    "protected",
    "sign-in",
    "sign-up",
    "success",
  ])
    await expect(
      access(root + `app/(auth)/auth/${page}/page.tsx`),
    ).resolves.toBeUndefined();
});

it("keeps Next config minimal, without legacy HTTP server forwarding or archive imports", async () => {
  const config = await readFile(root + "next.config.ts", "utf8");
  expect(config).not.toMatch(/rewrites|webpack|serverUrl/);
  expect(config).not.toMatch(/turbopack|node:|utils\//);
  const directories = [
    "app",
    "controllers",
    "middlewares",
    "routes",
    "models",
    "lib",
    "utils",
  ];
  for (const directory of directories) {
    for (const file of await sources(directory)) {
      const content = await readFile(root + file, "utf8");
      expect(content, file).not.toMatch(
        /from\s+["'][^"']*(?:\/pkg\/|@\/lib\/http|@\/lib\/utils)/,
      );
      expect(content, file).not.toContain("/proxy/chat");
      if (file !== "utils/environment.ts")
        expect(content, file).not.toContain("process.env");
    }
  }
});

it("uses the app caller to resolve same-origin endpoints and retains the upstream fetcher", async () => {
  const caller = await readFile(root + "utils/caller.tsx", "utf8");
  expect(caller).toContain("formatApiPath(url)");
  expect(caller).toContain("export function defineQuery");
  expect(await readFile(root + "utils/fetcher.ts", "utf8")).toBe(
    (await readFile(root + "pkg/client/utils/fetcher.ts", "utf8")).replaceAll(
      "@gorth/",
      "@gorth-com/",
    ),
  );
});
