import { Router } from "express"
import { splat, syncUser } from "@/controllers/auth"
import { requireAuth } from "@/middlewares/auth"

export function authRoutes() {
  const router = Router()
  router.post("/sync-user", requireAuth({ freshProfile: true }), syncUser)
  router.all("/*splat", splat)
  return router
}
