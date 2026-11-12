import "server-only"
import { createRealtimeApp } from "@/lib/realtime/app"
import { upgradeVercelWebSocket } from "@/lib/realtime/vercel"

const app = createRealtimeApp(upgradeVercelWebSocket)
export function realtimeHandler(request: Request) {
  return app.fetch(request)
}
