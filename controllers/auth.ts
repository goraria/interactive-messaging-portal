import type { Context } from "hono";
import type { ApiEnv } from "@/utils/interface";
import { rawSyncUser as syncUserServices } from "@/models/user";
import { authServer } from "@/lib/auth/server";
import { AuthError } from "@gorth-com/structure/modules/auth/server";
import {
  rawVerifyBackchannelLogoutToken,
  rawEndSsoSessions,
} from "@/models/revocation";

export async function actSync(context: Context<ApiEnv>) {
  const auth = context.get("auth");
  if (!auth?.user) {
    return context.json({ error: "unauthorized" }, 401);
  }
  try {
    const user = await syncUserServices({
      id: auth.user.id,
      name: auth.user.name ?? auth.user.email.split("@")[0] ?? auth.user.email,
      username: auth.user.username,
      email: auth.user.email,
      image: auth.user.image,
      status: auth.user.status,
    });
    return context.json({ data: user }, 200);
  } catch (error) {
    throw error;
  }
}

export function actSyncMethodNotAllowed(context: Context<ApiEnv>) {
  return context.json({ error: "method_not_allowed" }, 405, { Allow: "POST" });
}

export function actNativeAuth(context: Context<ApiEnv>) {
  return authServer.handler(context.req.raw);
}

export async function actBackchannelLogout(context: Context<ApiEnv>) {
  context.header("Cache-Control", "no-store");
  try {
    if (
      !context.req
        .header("content-type")
        ?.startsWith("application/x-www-form-urlencoded")
    )
      return context.json({ error: "invalid_request" }, 415);
    const reader = context.req.raw.body?.getReader();
    if (!reader) return context.json({ error: "invalid_request" }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 32768) {
          await reader.cancel();
          return context.json({ error: "payload_too_large" }, 413);
        }
        chunks.push(part.value);
      }
    } finally {
      reader.releaseLock();
    }
    const form = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
    const token = form.get("logout_token");
    if (!token || form.getAll("logout_token").length !== 1)
      return context.json({ error: "invalid_request" }, 400);
    await rawEndSsoSessions(
      await rawVerifyBackchannelLogoutToken(token),
    );
    return context.body(null, 200);
  } catch (error) {
    const unavailable =
      !(error instanceof AuthError) ||
      error.code === "unavailable" ||
      error.code === "invalid_configuration";
    return context.json(
      { error: unavailable ? "auth_unavailable" : "invalid_logout_token" },
      unavailable ? 503 : 400,
    );
  }
}
