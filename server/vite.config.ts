import { defineConfig } from "vite"
import { corsOptions } from "@gorth/mechanism/configs/cors"
import { developmentServerPlugin } from "./configs/vite.ts"
import { clientUrl } from "./lib/utils/environment.ts"

export default defineConfig({
  appType: "custom",
  clearScreen: false,
  logLevel: "warn",

  server: {
    host: true,
    strictPort: true,
    cors: {
      ...corsOptions,
      origin: clientUrl,
    },
  },

  resolve: {
    alias: {
      "@": import.meta.dirname,
    },
  },

  plugins: [developmentServerPlugin],

  build: {
    ssr: "app/main.ts",
    outDir: "dist",
    target: "node22",
    sourcemap: true,

    rollupOptions: {
      output: {
        entryFileNames: "index.js",
      },
    },
  },
})
