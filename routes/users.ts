import { Hono } from "hono"
import type { ApiEnv } from "@/utils/interface"
import {
  createUser,
  deleteUser,
  getCurrentUser,
  getUser,
  listUsers,
  updateUser,
} from "@/controllers/users"
import { requireAuth } from "@/middlewares/auth"

export function usersRoutes() {
  const router = new Hono<ApiEnv>()
  router.get("/user", requireAuth(), listUsers)
  router.post("/user", requireAuth(), createUser)
  router.get("/user/me", requireAuth(), getCurrentUser)
  router.get("/user/:userId", requireAuth(), getUser)
  router.patch("/user/:userId", requireAuth(), updateUser)
  router.delete("/user/:userId", requireAuth(), deleteUser)
  return router
}
