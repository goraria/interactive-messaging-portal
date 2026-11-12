import { Router } from "@/lib/http"
import {
  createMessageReaction,
  deleteMessageReaction,
  listMessageReactions,
} from "@/controllers/message-reactions"
import { requireAuth } from "@/middlewares/auth"

export function messageReactionsRoutes() {
  const router = Router()
  router.get("/message/:messageId/reaction", requireAuth(), listMessageReactions)
  router.post("/message/:messageId/reaction", requireAuth(), createMessageReaction)
  router.delete("/reaction/:reactionId", requireAuth(), deleteMessageReaction)
  return router
}
