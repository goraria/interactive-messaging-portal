import "server-only";
import type { MiddlewareHandler, ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ApiEnv } from "@/utils/interface";
import { appUrl } from "@/utils/environment";
import { httpError } from "@/middlewares/http";

export function requireSocket(): MiddlewareHandler<ApiEnv> {
  return async (context, next) => {
    if (!appUrl || context.req.header("origin") !== new URL(appUrl).origin)
      return context.json({ error: "invalid_origin" }, 403);
    if (context.req.header("upgrade")?.toLowerCase() !== "websocket")
      return context.json({ error: "websocket_upgrade_required" }, 426);
    if (context.req.header("authorization"))
      return context.json({ error: "session_required" }, 401);
    await next();
  };
}

export const socketError: ErrorHandler = (error, context) => {
  if (context.req.path.endsWith("/token")) return httpError(error, context);
  if (error instanceof HTTPException) return error.getResponse();
  const status = (error as { statusCode?: number }).statusCode;
  return context.json(
    { error: "realtime_unavailable" },
    status === 403 || status === 404 ? status : 503,
  );
};
