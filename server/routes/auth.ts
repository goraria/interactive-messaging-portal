import { Router } from "express"
import { me, splat, syncUser } from "@/controllers/auth"
import { requireAuth } from "@/middlewares/auth"

export function authRoutes() {
  const router = Router()
  router.post("/sync-user", requireAuth(), syncUser)
  router.get("/me", me)
  router.all("/*splat", splat)
  return router
}
