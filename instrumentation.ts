import { registerVercelTelemetry } from "@gorth-io/principle/configs/vercel"
import {
  nextPhase,
  vercelDeployment,
  vercelTelemetryEnabled,
} from "@/utils/environment"

export async function register() {
  registerVercelTelemetry(
    "interactive-messaging-portal",
    vercelTelemetryEnabled
  )
  // The same Node process hosts Next and Hono; no launcher or child process.
  // Never bind a listener in build workers or Vercel's managed functions.
  // Framework compile-time marker: keep this literal guard around the import.
  // An imported runtime alias cannot exclude Node APIs from the Edge graph.
  // Application configuration remains centralized in utils/environment.ts.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (nextPhase === "phase-production-build" || vercelDeployment) return
    const { startRealtimeServer } = await import("@/lib/realtime/server")
    await startRealtimeServer()
  }
}
