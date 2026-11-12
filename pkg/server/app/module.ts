import { Hono } from "hono"
import { configureHono } from "@gorth/principle/configs/hono"
import { HTTPException } from "hono/http-exception"

import {
  getCorsOrigins,
  isProduction,
  rateLimitEnabled,
} from "@/utils/environment"
import { DatabaseRateLimitStore } from "@/lib/rate-limit/database-store"
import { getOAuthProtectedResourceMetadata } from "@/services/sso"
import backchannelRoutes from "@/routes/backchannel"
import sessionRoutes from "@/routes/session"
import { authRoutes } from "@/routes/auth"
import { conversationMembersRoutes } from "@/routes/conversation-members"
import { conversationsRoutes } from "@/routes/conversations"
import labRoutes from "@/routes/lab"
import { messageAttachmentsRoutes } from "@/routes/message-attachments"
import { messageReactionsRoutes } from "@/routes/message-reactions"
import { messageReceiptsRoutes } from "@/routes/message-receipts"
import { messagesRoutes } from "@/routes/messages"
import { realtimeRoutes } from "@/routes/realtime"
import sharedRoutes from "@/routes/shared"
import { usersRoutes } from "@/routes/users"

export function createApp() {
  const app = new Hono()
  const corsOrigins = getCorsOrigins()

  configureHono(app, {
    development: !isProduction,
    cors: {
      origin: (origin) => (corsOrigins.includes(origin) ? origin : null),
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Authorization", "Content-Type", "X-Request-Id", "DPoP"],
      exposeHeaders: [
        "Content-Length",
        "X-Request-Id",
        "Server-Timing",
        "RateLimit-Limit",
        "RateLimit-Remaining",
        "RateLimit-Reset",
        "Retry-After",
        "WWW-Authenticate",
        "DPoP-Nonce",
      ],
      credentials: true,
      maxAge: 86400,
    },
    csrf: {
      origin: (origin, context) =>
        corsOrigins.includes(origin) ||
        origin === new URL(context.req.url).origin,
      skip: (context) =>
        context.req.path === "/auth/backchannel-logout" ||
        context.req.header("authorization")?.startsWith("Bearer ") === true,
    },
    rateLimit: rateLimitEnabled
      ? {
          store: new DatabaseRateLimitStore(),
          keyGenerator: (context) =>
            context.req.header("x-real-ip") ??
            context.req.header("x-forwarded-for")?.split(",").at(-1)?.trim() ??
            "unknown",
          skip: (context) => context.req.path === "/health",
        }
      : false,
    bodyLimit: {
      maxSize: 50 * 1024 * 1024,
      onError: (context) => context.json({ error: "payload_too_large" }, 413),
    },
    compress: true,
  })

  app.route("/auth", backchannelRoutes)
  app.route("/auth", sessionRoutes)
  app.route("/auth", authRoutes().hono)
  app.route("/chat", usersRoutes().hono)
  app.route("/chat", conversationsRoutes().hono)
  app.route("/chat", conversationMembersRoutes().hono)
  app.route("/chat", messagesRoutes().hono)
  app.route("/chat", realtimeRoutes().hono)
  app.route("/chat", messageAttachmentsRoutes().hono)
  app.route("/chat", messageReactionsRoutes().hono)
  app.route("/chat", messageReceiptsRoutes().hono)
  app.route("/lab", labRoutes.hono)
  app.route("/", sharedRoutes.hono)
  app.get("/.well-known/oauth-protected-resource", (context) =>
    context.json(getOAuthProtectedResourceMetadata())
  )

  app.get("/health", (context) =>
    context.json({ status: "ok", timestamp: new Date().toISOString() })
  )

  app.notFound((context) =>
    context.json(
      {
        error: "not_found",
        message: `Route ${context.req.method} ${context.req.path} not found`,
      },
      404
    )
  )
  app.onError((error, context) => {
    console.error("[server-error]", error)
    if (error instanceof HTTPException) return error.getResponse()
    return context.json(
      {
        error: "internal_server_error",
        message: isProduction ? undefined : error.message,
      },
      500
    )
  })

  return app
}

export default createApp
