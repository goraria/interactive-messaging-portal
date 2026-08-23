import { Router } from "express"
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
  const router = Router()
  router.use(requireAuth())
  router.get("/users", listUsers)
  router.post("/users", createUser)
  router.get("/users/me", getCurrentUser)
  router.get("/users/:userId", getUser)
  router.patch("/users/:userId", updateUser)
  router.delete("/users/:userId", deleteUser)
  return router
}
