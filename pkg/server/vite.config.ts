import build from "@hono/vite-build/vercel"
import devServer from "@hono/vite-dev-server"
import { defineConfig } from "vite"

export default defineConfig({
  publicDir: "assets",
  clearScreen: false,
  build: {
    rollupOptions: {
      output: { codeSplitting: false },
    },
  },
  server: { cors: false, host: true, strictPort: true },
  resolve: { alias: { "@": import.meta.dirname } },
  plugins: [
    devServer({
      entry: "app/index.ts",
      loadModule: async (server, entry) => {
        const { default: app } = await server.ssrLoadModule(entry)
        return {
          // Vite disables Node global overrides; materialize its lightweight request
          // before body-limit reconstructs a native Fetch Request.
          fetch: (request, env, executionContext) =>
            app.fetch(
              new Request(request.url, {
                method: request.method,
                headers: request.headers,
                body: request.body,
                signal: request.signal,
                ...(request.body ? { duplex: "half" } : {}),
              }),
              env,
              executionContext
            ),
        }
      },
    }),
    build({
      entry: "app/index.ts",
      emptyOutDir: true,
      entryContentAfterHooks: [
        () =>
          "import { getRequestListener } from '@gorth/principle/cores/hono/server'",
      ],
      entryContentDefaultExportHook: (appName) =>
        `export default getRequestListener(${appName}.fetch)`,
    }),
  ],
})
