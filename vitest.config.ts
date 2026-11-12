import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  envDir: false,
  resolve: {
    dedupe: ["hono", "better-auth", "react", "react-dom"],
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tests/server-only-fixture.ts", import.meta.url)
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/cloud/**"],
    restoreMocks: true,
    fileParallelism: false,
    testTimeout: 15000,
  },
})
