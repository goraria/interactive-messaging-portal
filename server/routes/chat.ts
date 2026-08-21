import { Router } from "express"
import {
  addConversationMember,
  createConversation,
  createConversationMessage,
  createMessageAttachment,
  createMessageReaction,
  createMessageReceipt,
  createRoomMessage,
  createUser,
  deleteConversation,
  deleteMessage,
  deleteMessageAttachment,
  deleteMessageReaction,
  deleteMessageReceipt,
  deleteUser,
  getConversation,
  getCurrentUser,
  getMessage,
  getUser,
  listConversationMembers,
  listConversationMessages,
  listConversations,
  listMessageAttachments,
  listMessageReactions,
  listMessageReceipts,
  listRoomMessages,
  listUsers,
  removeConversationMember,
  updateConversation,
  updateConversationMember,
  updateMessage,
  updateMessageAttachment,
  updateMessageReceipt,
  updateUser,
} from "@/controllers/chat"
import { requireAuth } from "@/middlewares/auth"

const router = Router()

router.get("/users", listUsers)
router.post("/users", createUser)
router.get("/users/me", requireAuth(), getCurrentUser)
router.get("/users/:userId", getUser)
router.patch("/users/:userId", updateUser)
router.delete("/users/:userId", deleteUser)

router.get("/conversations", requireAuth(), listConversations)
router.post("/conversations", createConversation)
router.get("/conversations/:conversationId", requireAuth(), getConversation)
router.patch("/conversations/:conversationId", updateConversation)
router.delete("/conversations/:conversationId", deleteConversation)

router.get("/conversations/:conversationId/members", listConversationMembers)
router.post("/conversations/:conversationId/members", addConversationMember)
router.patch("/conversations/:conversationId/members/:userId", updateConversationMember)
router.delete("/conversations/:conversationId/members/:userId", removeConversationMember)

router.get(
  "/conversations/:conversationId/messages",
  requireAuth(),
  listConversationMessages,
)
router.post(
  "/conversations/:conversationId/messages",
  requireAuth(),
  createConversationMessage,
)
router.get("/messages/:messageId", getMessage)
router.patch("/messages/:messageId", updateMessage)
router.delete("/messages/:messageId", deleteMessage)

router.get("/messages/:messageId/attachments", listMessageAttachments)
router.post("/messages/:messageId/attachments", createMessageAttachment)
router.patch("/attachments/:attachmentId", updateMessageAttachment)
router.delete("/attachments/:attachmentId", deleteMessageAttachment)

router.get("/messages/:messageId/reactions", listMessageReactions)
router.post("/messages/:messageId/reactions", createMessageReaction)
router.delete("/reactions/:reactionId", deleteMessageReaction)

router.get("/messages/:messageId/receipts", listMessageReceipts)
router.post("/messages/:messageId/receipts", createMessageReceipt)
router.patch("/receipts/:receiptId", updateMessageReceipt)
router.delete("/receipts/:receiptId", deleteMessageReceipt)

router.get("/rooms/:roomName/messages", listRoomMessages)
router.post("/rooms/:roomName/messages", createRoomMessage)

export default router
