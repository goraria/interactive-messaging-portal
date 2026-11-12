import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"
export default defineConfig({
  root: fileURLToPath(new URL("../client", import.meta.url)),
  envDir: false,
  resolve: {
    dedupe: ["next", "@gorth/structure"],
    alias: {
      "@": fileURLToPath(new URL("../client", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tests/server-only-fixture.ts", import.meta.url)
      ),
    },
  },
  test: {
    environment: "node",
    include: ["../server/tests/client*.test.ts"],
    restoreMocks: true,
    testTimeout: 15_000,
  },
})
