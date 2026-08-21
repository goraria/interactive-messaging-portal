import { defineConfig } from "vite"
import { corsOptions } from "@gorth/mechanism/configs/cors"
import { developmentServerPlugin } from "./configs/vite.ts"

export default defineConfig({
  appType: "custom",
  clearScreen: false,
  logLevel: "warn",

  server: {
    host: true,
    strictPort: true,
    cors: corsOptions,
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
