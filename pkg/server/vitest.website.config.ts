import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"
export default defineConfig({
  envDir: false,
  test: {
    projects: ["gorth-browser-website", "gorth-launcher-website"].map(
      (name) => ({
        envDir: false,
        root: fileURLToPath(new URL("../../" + name, import.meta.url)),
        resolve: {
          dedupe: ["next", "@gorth/structure"],
          alias: {
            "@": fileURLToPath(new URL("../../" + name, import.meta.url)),
            "server-only": fileURLToPath(
              new URL("./tests/server-only-fixture.ts", import.meta.url)
            ),
          },
        },
        test: {
          name,
          environment: "node",
          restoreMocks: true,
          include: [
            "../interactive-messaging-portal/server/tests/website*.test.ts",
            "../interactive-messaging-portal/server/tests/store.test.ts",
          ],
        },
      })
    ),
  },
})
