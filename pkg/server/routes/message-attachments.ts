import { Router } from "@/lib/http"
import {
  createMessageAttachment,
  deleteMessageAttachment,
  listMessageAttachments,
  updateMessageAttachment,
} from "@/controllers/message-attachments"
import { requireAuth } from "@/middlewares/auth"

export function messageAttachmentsRoutes() {
  const router = Router()
  router.get("/message/:messageId/attachment", requireAuth(), listMessageAttachments)
  router.post("/message/:messageId/attachment", requireAuth(), createMessageAttachment)
  router.patch("/attachment/:attachmentId", requireAuth(), updateMessageAttachment)
  router.delete("/attachment/:attachmentId", requireAuth(), deleteMessageAttachment)
  return router
}
