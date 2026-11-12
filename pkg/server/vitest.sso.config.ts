import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  root: fileURLToPath(new URL("../../single-sign-on/client", import.meta.url)),
  envDir: false,
  resolve: {
    dedupe: ["next", "@gorth/structure"],
    alias: {
      "@": fileURLToPath(
        new URL("../../single-sign-on/client", import.meta.url)
      ),
    },
  },
  test: {
    environment: "node",
    include: ["../../interactive-messaging-portal/server/tests/sso*.test.ts"],
    restoreMocks: true,
  },
})
