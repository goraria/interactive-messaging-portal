import { Hono } from "hono";
import { requireAuth } from "@/middlewares/auth";
import { actDownloadChatAttachment } from "@/controllers/chat";

export const attachmentRoutes = new Hono();
attachmentRoutes.get(
  "/:attachmentId/download",
  requireAuth(),
  actDownloadChatAttachment,
);
