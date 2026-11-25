import "server-only";
import { Hono } from "hono";
import type { UpgradeWebSocket } from "hono/ws";
import { configureHono } from "@gorth-com/principle/configs/hono";
import { requireAuth } from "@/middlewares/auth";
import { http } from "@/middlewares/http";
import { requireSocket, socketError } from "@/middlewares/socket";
import {
  actCreateConversationToken,
  actCreateSocketHandlers,
} from "@/controllers/realtime";
import { upgradeVercelWebSocket } from "@/lib/realtime/vercel";

export function createSocketRoutes<Socket>(upgrade: UpgradeWebSocket<Socket>) {
  const router = new Hono();
  configureHono(router, {
    logger: false,
    cors: false,
    csrf: false,
    rateLimit: false,
    compress: false,
    etag: false,
    bodyLimit: { maxSize: 1024 },
  });
  const handlers = actCreateSocketHandlers(upgrade);
  router.get("/:id/chat", requireSocket(), requireAuth(), handlers.chat);
  router.get("/:id/call", requireSocket(), requireAuth(), handlers.call);
  router.get(
    "/:id/token",
    http,
    requireAuth(),
    actCreateConversationToken,
  );
  router.onError(socketError);
  return router;
}

export const socketRoutes = createSocketRoutes(upgradeVercelWebSocket);
