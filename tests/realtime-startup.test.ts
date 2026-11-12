import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { existsSync, readFileSync } from "node:fs"
const state = vi.hoisted(() => ({
  config: {
    nextRuntime: "nodejs",
    nextPhase: "phase-development-server",
    vercelDeployment: false,
    vercelTelemetryEnabled: false,
  },
  start: vi.fn(),
  telemetry: vi.fn(),
}))
vi.mock("@/utils/environment", () => state.config)
vi.mock("@/lib/realtime/server", () => ({ startRealtimeServer: state.start }))
vi.mock("@gorth-io/principle/configs/vercel", () => ({
  registerVercelTelemetry: state.telemetry,
}))
import { register } from "@/instrumentation"
beforeEach(() => {
  state.start.mockReset()
  state.telemetry.mockReset()
  Object.assign(state.config, {
    nextRuntime: "nodejs",
    nextPhase: "phase-development-server",
    vercelDeployment: false,
    vercelTelemetryEnabled: false,
  })
  vi.stubEnv("NEXT_RUNTIME", "nodejs")
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
it.each(["phase-development-server", "phase-production-server"])(
  "starts Hono during %s without a launcher",
  async (nextPhase) => {
    state.config.nextPhase = nextPhase
    await register()
    expect(state.start).toHaveBeenCalledOnce()
    expect(state.telemetry).toHaveBeenCalledWith(
      "interactive-messaging-portal",
      false
    )
  }
)
it.each([
  { nextPhase: "phase-production-build" },
  { nextRuntime: "edge" },
  { vercelDeployment: true },
])("does not open a listener for %j", async (config) => {
  Object.assign(state.config, config)
  if ("nextRuntime" in config) vi.stubEnv("NEXT_RUNTIME", config.nextRuntime)
  await register()
  expect(state.start).not.toHaveBeenCalled()
})
it("reports startup failures instead of claiming realtime is available", async () => {
  state.start.mockImplementation(() => {
    throw new Error("port in use")
  })
  await expect(register()).rejects.toThrow("port in use")
})
it("excludes the Node listener with Next's literal compile-time runtime guard", async () => {
  vi.stubEnv("NEXT_RUNTIME", "edge")
  await register()
  expect(state.start).not.toHaveBeenCalled()
  const source = readFileSync(
    new URL("../instrumentation.ts", import.meta.url),
    "utf8"
  )
  expect(source).toMatch(
    /if \(process\.env\.NEXT_RUNTIME === "nodejs"\) \{[\s\S]*await import\("@\/lib\/realtime\/server"\)/
  )
})
it("keeps plain Next commands and Hono + ws without launcher scripts or a forced Bun runtime", () => {
  const root = new URL("../", import.meta.url)
  const manifest = JSON.parse(
    readFileSync(new URL("package.json", root), "utf8")
  )
  expect(manifest.scripts.dev).toMatch(/^next dev(?: --port 3030)?$/)
  expect(manifest.scripts.start).toBe("next start")
  expect(manifest.scripts.realtime).toBeUndefined()
  const server = readFileSync(new URL("lib/realtime/server.ts", root), "utf8")
  expect(server).toContain('from "ws"')
  expect(server).toContain('from "@hono/node-server"')
  expect(server).not.toMatch(/hono\/bun|@hono\/node-ws|Bun\.serve/)
  expect(existsSync(new URL("bunfig.toml", root))).toBe(false)
  for (const file of [
    "scripts/chat-runtime.mjs",
    "scripts/realtime-server.mjs",
  ])
    expect(existsSync(new URL(file, root))).toBe(false)
})
