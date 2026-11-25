import "server-only";
import { APIError } from "better-auth";
import { isInsufficientScopeError } from "better-auth/oauth2";
import { AuthError } from "@gorth-com/structure/modules/auth/server";

export function isMutationRequest(request: Request) {
  return !["GET", "HEAD", "OPTIONS"].includes(request.method);
}

export function isLocalUserActive(
  user: {
    status: string;
    deletedAt?: Date | null;
    bannedAt?: Date | null;
    banExpires?: Date | null;
  },
  now = Date.now(),
) {
  return (
    user.status === "active" &&
    !user.deletedAt &&
    (!user.bannedAt ||
      Boolean(user.banExpires && user.banExpires.getTime() <= now))
  );
}

export function isIdentityStale(user: { syncedAt: Date }, now = Date.now()) {
  return user.syncedAt.getTime() <= now - 120_000;
}

interface AuthFailure {
  status: 401 | 403 | 503;
  body: { error: string; scope?: string };
  challenge?: string;
}

// Keep each boundary's existing response contract while sharing classification.
// Never expose exception messages, credentials or provider response bodies.
export function classifyAuthError(
  error: unknown,
  boundary: "api" | "session" = "api",
): AuthFailure {
  if (error instanceof AuthError) {
    if (boundary === "session") {
      if (error.code === "forbidden")
        return { status: 403, body: { error: "user_not_active" } };
      if (error.code === "rejected")
        return { status: 401, body: { error: "invalid_session" } };
      return { status: 503, body: { error: "auth_unavailable" } };
    }
    const status = ["unavailable", "invalid_configuration"].includes(error.code)
      ? 503
      : error.code === "forbidden" || error.code === "rejected"
        ? 403
        : 401;
    return { status, body: { error: error.code } };
  }
  if (boundary === "api" && isInsufficientScopeError(error)) {
    const scope =
      typeof error.body?.scope === "string" ? error.body.scope : undefined;
    return {
      status: 403,
      body: { error: "insufficient_scope", ...(scope ? { scope } : {}) },
      challenge: `Bearer error="insufficient_scope"${scope ? `, scope=${JSON.stringify(scope)}` : ""}`,
    };
  }
  if (error instanceof APIError) {
    const status =
      error.statusCode === 401
        ? 401
        : boundary === "api" && error.statusCode === 403
          ? 403
          : 503;
    return {
      status,
      body: { error: status === 503 ? "auth_unavailable" : "unauthorized" },
    };
  }
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  if (/^(ERR_JWT|ERR_JWS|ERR_JOSE|ERR_DPOP)/.test(code))
    return { status: 401, body: { error: "invalid_access_token" } };
  return { status: 503, body: { error: "auth_unavailable" } };
}
