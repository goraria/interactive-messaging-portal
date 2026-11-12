import { Router } from "@/lib/http"
import {
  createMessageReceipt,
  deleteMessageReceipt,
  listMessageReceipts,
  updateMessageReceipt,
} from "@/controllers/message-receipts"
import { requireAuth } from "@/middlewares/auth"

export function messageReceiptsRoutes() {
  const router = Router()
  router.get("/message/:messageId/receipt", requireAuth(), listMessageReceipts)
  router.post("/message/:messageId/receipt", requireAuth(), createMessageReceipt)
  router.patch("/receipt/:receiptId", requireAuth(), updateMessageReceipt)
  router.delete("/receipt/:receiptId", requireAuth(), deleteMessageReceipt)
  return router
}
