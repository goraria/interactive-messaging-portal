import { Hono } from "hono";
import { requireAuth } from "@/middlewares/auth";
import {
  actListChatConversations,
  actStartChatConversation,
  actGetChatConversation,
  actChangeChatConversation,
  actArchiveChatConversation,
  actListChatMembers,
  actChangeChatMember,
  actSetChatMute,
  actListChatMessages,
  actSendChatMessage,
  actReplayChatEvents,
  actSearchChatMessages,
  actChatDeliveryStatus,
  actRetryChatDelivery,
  actCreateChatUpload,
  actFinishChatUpload,
  actListChatCalls,
  actStartChatCall,
} from "@/controllers/chat";

export const conversationRoutes = new Hono();
conversationRoutes.get("/", requireAuth(), actListChatConversations);
conversationRoutes.post("/", requireAuth(), actStartChatConversation);
conversationRoutes.get("/:id", requireAuth(), actGetChatConversation);
conversationRoutes.patch("/:id", requireAuth(), actChangeChatConversation);
conversationRoutes.delete("/:id", requireAuth(), actArchiveChatConversation);
conversationRoutes.get("/:id/member", requireAuth(), actListChatMembers);
conversationRoutes.post("/:id/member", requireAuth(), actChangeChatMember);
conversationRoutes.patch(
  "/:id/member/:userId",
  requireAuth(),
  actChangeChatMember,
);
conversationRoutes.delete(
  "/:id/member/:userId",
  requireAuth(),
  actChangeChatMember,
);
conversationRoutes.patch("/:id/preference", requireAuth(), actSetChatMute);
conversationRoutes.get("/:id/message", requireAuth(), actListChatMessages);
conversationRoutes.post("/:id/message", requireAuth(), actSendChatMessage);
conversationRoutes.get("/:id/event", requireAuth(), actReplayChatEvents);
conversationRoutes.get("/:id/search", requireAuth(), actSearchChatMessages);
conversationRoutes.get("/:id/delivery", requireAuth(), actChatDeliveryStatus);
conversationRoutes.post(
  "/:id/delivery/:eventId/retry",
  requireAuth(),
  actRetryChatDelivery,
);
conversationRoutes.post("/:id/upload", requireAuth(), actCreateChatUpload);
conversationRoutes.post(
  "/:id/upload/:uploadId/complete",
  requireAuth(),
  actFinishChatUpload,
);
conversationRoutes.post(
  "/:id/upload/:uploadId/abort",
  requireAuth(),
  actFinishChatUpload,
);
conversationRoutes.get("/:id/call", requireAuth(), actListChatCalls);
conversationRoutes.post("/:id/call", requireAuth(), actStartChatCall);
