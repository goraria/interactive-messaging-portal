import { Hono } from "hono"
import type { ApiEnv } from "@/utils/interface"

import { createConversationToken } from "@/controllers/realtime"
import { requireAuth } from "@/middlewares/auth"

export function realtimeRoutes() {
  const router = new Hono<ApiEnv>()
  router.get(
    "/conversation/:conversationId/realtime/token",
    requireAuth(),
    createConversationToken
  )
  return router
}
