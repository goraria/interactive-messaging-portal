import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  // ...nextVitals,
  // ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".vercel/**",
    "out/**",
    "build/**",
    "vite-env.d.ts",
  ]),
]);
