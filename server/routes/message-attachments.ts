import { Router } from "express"
import {
  createMessageAttachment,
  deleteMessageAttachment,
  listMessageAttachments,
  updateMessageAttachment,
} from "@/controllers/message-attachments"
import { requireAuth } from "@/middlewares/auth"

export function messageAttachmentsRoutes() {
  const router = Router()
  router.use(requireAuth())
  router.get("/messages/:messageId/attachments", listMessageAttachments)
  router.post("/messages/:messageId/attachments", createMessageAttachment)
  router.patch("/attachments/:attachmentId", updateMessageAttachment)
  router.delete("/attachments/:attachmentId", deleteMessageAttachment)
  return router
}
