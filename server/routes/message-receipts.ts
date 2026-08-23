import { Router } from "express"
import {
  createMessageReceipt,
  deleteMessageReceipt,
  listMessageReceipts,
  updateMessageReceipt,
} from "@/controllers/message-receipts"
import { requireAuth } from "@/middlewares/auth"

export function messageReceiptsRoutes() {
  const router = Router()
  router.use(requireAuth())
  router.get("/messages/:messageId/receipts", listMessageReceipts)
  router.post("/messages/:messageId/receipts", createMessageReceipt)
  router.patch("/receipts/:receiptId", updateMessageReceipt)
  router.delete("/receipts/:receiptId", deleteMessageReceipt)
  return router
}
