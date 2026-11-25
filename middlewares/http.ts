import "server-only";
import { after } from "next/server";
import { Hono } from "hono";
import type { ErrorHandler, MiddlewareHandler, NotFoundHandler } from "hono";
import { every } from "hono/combine";
import { HTTPException } from "hono/http-exception";
import { methodNotAllowed } from "hono/method-not-allowed";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { configureHono } from "@gorth-com/principle/configs/hono";
import { ZodError } from "@gorth-com/structure/cores/zod";
import { appUrl, isProduction, rateLimitEnabled } from "@/utils/environment";
import { createDatabaseRateLimitStore } from "@/lib/rate-limit/database-store";
import type { ApiEnv } from "@/utils/interface";
import type { ServiceError } from "@/utils/service";
import { rawEnqueueBackgroundJob } from "@/services/background";
import { rawDispatchChatEvents } from "@/models/chat-delivery";
import { withRealtimeMutations } from "@/lib/realtime/mutation";
import { withRequestTiming } from "@/utils/server/timing";

// Collect the shared package's middleware once; requests keep their own Context.
const policies = new Hono();
configureHono(policies, {
  development: !isProduction,
  logger: false, // OAuth callback URLs contain authorization codes.
  cors: false,
  csrf: {
    origin: (origin) => Boolean(appUrl) && origin === new URL(appUrl).origin,
    skip: (context) =>
      (context.req.path.startsWith("/auth/") &&
        context.req.path !== "/auth/sync") ||
      context.req.header("authorization")?.startsWith("Bearer ") === true,
  },
  rateLimit: rateLimitEnabled
    ? {
        store: createDatabaseRateLimitStore(),
        // Forwarded IP headers require a deployment-specific trust policy.
        // Default to a conservative shared bucket instead of trusting user input.
        keyGenerator: () => "chat",
        skip: (context) => ["/health", "/internal/health"].includes(context.req.path),
      }
    : false,
  bodyLimit: {
    maxSize: 50 * 1024 * 1024,
    onError: (context) => context.json({ error: "payload_too_large" }, 413),
  },
  compress: false,
  etag: false,
});

async function deliverRealtimeEvents() {
  try {
    const { failed } = await rawDispatchChatEvents(undefined, "realtime");
    if (!failed) return;
  } catch {
    // The committed outbox remains available to Queue and Cron recovery.
  }
  console.error("[background] realtime_deferred; outbox retained for recovery");
}

const background: MiddlewareHandler<ApiEnv> = async (context, next) => {
  let committed = false;
  const response = await withRealtimeMutations(
    async () => {
      await next();
      return context.res;
    },
    () => {
      committed = true;
    },
  );
  const pathname = context.req.path;
  if (
    response.ok &&
    committed &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(context.req.method) &&
    pathname !== "/auth" &&
    !pathname.startsWith("/auth/")
  ) {
    after(async () => {
      await Promise.all([
        deliverRealtimeEvents(),
        rawEnqueueBackgroundJob().catch((error: unknown) => {
          const failure = error as { name?: unknown; status?: unknown };
          console.error(
            "[background] enqueue_failed; outbox retained for recovery",
            {
              // Never print provider messages, URLs, headers or credentials.
              category: [
                "UnauthorizedError",
                "ForbiddenError",
                "TooManyRequestsError",
              ].includes(String(failure?.name))
                ? failure.name
                : "queue_unavailable",
              status:
                typeof failure?.status === "number"
                  ? failure.status
                  : undefined,
            },
          );
        }),
      ]);
    });
  }
};

const noStore: MiddlewareHandler<ApiEnv> = async (context, next) => {
  await next();
  context.header("Cache-Control", "no-store");
};

const timing: MiddlewareHandler<ApiEnv> = async (context, next) => {
  const { header } = await withRequestTiming(next);
  context.header("Server-Timing", header);
};

// Hono's public every() combines middleware without dispatching another request.
export const http: MiddlewareHandler<ApiEnv> = every(
  timing,
  background,
  ...policies.routes.map((route) => route.handler),
  noStore,
);

// Native hooks belong to the endpoint router, rather than a middleware container.
export const httpError: ErrorHandler = (error, context) => {
  if (error instanceof HTTPException) return error.getResponse();
  if (error instanceof ZodError)
    return context.json(
      { error: "validation_failed", issues: error.issues },
      400,
    );
  const domain = error as Partial<ServiceError>;
  if (
    typeof domain.statusCode === "number" &&
    domain.statusCode >= 400 &&
    domain.statusCode <= 599 &&
    domain.code
  )
    return context.json(
      { error: domain.code },
      domain.statusCode as ContentfulStatusCode,
    );
  return context.json({ error: "internal_server_error" }, 500);
};
export const httpNotFound: NotFoundHandler = (context) =>
  context.json({ error: "not_found" }, 404);

export function httpMethods(app: Hono) {
  return methodNotAllowed({
    app,
    onMethodNotAllowed: (context, methods) =>
      context.json({ error: "method_not_allowed" }, 405, {
        Allow: methods.join(", "),
      }),
  });
}
