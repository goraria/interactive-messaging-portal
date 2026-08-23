import { Router } from "express"
import {
  createMessageReaction,
  deleteMessageReaction,
  listMessageReactions,
} from "@/controllers/message-reactions"
import { requireAuth } from "@/middlewares/auth"

export function messageReactionsRoutes() {
  const router = Router()
  router.use(requireAuth())
  router.get("/messages/:messageId/reactions", listMessageReactions)
  router.post("/messages/:messageId/reactions", createMessageReaction)
  router.delete("/reactions/:reactionId", deleteMessageReaction)
  return router
}
