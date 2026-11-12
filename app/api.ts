import "server-only"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { methodNotAllowed } from "hono/method-not-allowed"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import { configureHono } from "@gorth-io/principle/configs/hono"
import { ZodError } from "@gorth-io/structure/cores/zod"
import { appUrl, isProduction, rateLimitEnabled } from "@/utils/environment"
import { createDatabaseRateLimitStore } from "@/lib/rate-limit/database-store"
import { getOAuthProtectedResourceMetadata } from "@/services/sso"
import backchannelRoutes from "@/routes/backchannel"
import { authRoutes } from "@/routes/auth"
import labRoutes from "@/routes/lab"
import { realtimeRoutes } from "@/routes/realtime"
import { usersRoutes } from "@/routes/users"
import { platformRoutes } from "@/routes/platform"
import { demoRoutes } from "@/routes/demo"
import { chatRoutes, chatInternalRoutes } from "@/routes/chat"
import sharedRoutes from "@/routes/shared"
import type { ApiEnv } from "@/utils/interface"
import type { ServiceError } from "@/utils/service"

export function createApp() {
  const app = new Hono<ApiEnv>()
  configureHono(app, {
    development: !isProduction,
    logger: false, // OAuth callback URLs contain authorization codes.
    cors: false,
    csrf: {
      origin: (origin) => Boolean(appUrl) && origin === new URL(appUrl).origin,
      skip: (context) =>
        (context.req.path.startsWith("/auth/") &&
          context.req.path !== "/auth/sync-user") ||
        context.req.header("authorization")?.startsWith("Bearer ") === true,
    },
    rateLimit: rateLimitEnabled
      ? {
          store: createDatabaseRateLimitStore(),
          // Forwarded IP headers require a deployment-specific trust policy.
          // Default to a conservative shared bucket instead of trusting user input.
          keyGenerator: () => "chat",
          skip: (context) => context.req.path === "/health",
        }
      : false,
    bodyLimit: {
      maxSize: 50 * 1024 * 1024,
      onError: (context) => context.json({ error: "payload_too_large" }, 413),
    },
    compress: false,
    etag: false,
  })
  app.use("*", async (context, next) => {
    await next()
    context.header("Cache-Control", "no-store")
  })
  app.use(
    methodNotAllowed({
      app,
      onMethodNotAllowed: (context, methods) =>
        context.json({ error: "method_not_allowed" }, 405, {
          Allow: methods.join(", "),
        }),
    })
  )
  app.route("/auth", backchannelRoutes)
  app.route("/auth", authRoutes())
  for (const router of [usersRoutes(), chatRoutes(), realtimeRoutes()])
    app.route("/chat", router)
  app.route("/lab", labRoutes)
  app.route("/", chatInternalRoutes())
  app.route("/", platformRoutes())
  app.route("/demo", demoRoutes())
  app.route("/", sharedRoutes)
  app.get("/.well-known/oauth-protected-resource", (context) =>
    context.json(getOAuthProtectedResourceMetadata())
  )
  app.notFound((context) => context.json({ error: "not_found" }, 404))
  app.onError((error, context) => {
    if (error instanceof HTTPException) return error.getResponse()
    if (error instanceof ZodError)
      return context.json(
        { error: "validation_failed", issues: error.issues },
        400
      )
    const domain = error as Partial<ServiceError>
    if (
      typeof domain.statusCode === "number" &&
      domain.statusCode >= 400 &&
      domain.statusCode <= 599 &&
      domain.code
    )
      return context.json(
        { error: domain.code },
        domain.statusCode as ContentfulStatusCode
      )
    return context.json({ error: "internal_server_error" }, 500)
  })
  return app
}

export const api = createApp()
