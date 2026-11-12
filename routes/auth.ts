import { Hono } from "hono"
import type { ApiEnv } from "@/utils/interface"
import { syncUser } from "@/controllers/auth"
import { getAuth } from "@/lib/auth/server"
import { requireAuth } from "@/middlewares/auth"

export function authRoutes() {
  const router = new Hono<ApiEnv>()
  router.post("/sync-user", requireAuth({ freshProfile: true }), syncUser)
  router.on(["GET", "POST"], "/*", (context) =>
    getAuth().handler(context.req.raw)
  )
  return router
}
