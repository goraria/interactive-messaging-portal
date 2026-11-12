import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"
export default defineConfig({
  envDir: false,
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: [
      "tests/client*.test.ts",
      "tests/website*.test.ts",
      "tests/sso*.test.ts",
    ],
    restoreMocks: true,
    fileParallelism: false,
    testTimeout: 15_000,
  },
})
