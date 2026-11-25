import { Hono } from "hono";
import { requireAuth } from "@/middlewares/auth";
import {
  actGetChatMessage,
  actEditChatMessage,
  actDeleteChatMessage,
  actReactChatMessage,
  actAcknowledgeChatMessage,
  actReportChatMessage,
} from "@/controllers/chat";

export const messageRoutes = new Hono();
messageRoutes.get("/:id", requireAuth(), actGetChatMessage);
messageRoutes.patch("/:id", requireAuth(), actEditChatMessage);
messageRoutes.delete("/:id", requireAuth(), actDeleteChatMessage);
messageRoutes.post("/:id/reaction", requireAuth(), actReactChatMessage);
messageRoutes.delete("/:id/reaction", requireAuth(), actReactChatMessage);
messageRoutes.post("/:id/receipt", requireAuth(), actAcknowledgeChatMessage);
messageRoutes.post("/:id/report", requireAuth(), actReportChatMessage);
