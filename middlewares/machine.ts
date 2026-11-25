import type { MiddlewareHandler } from "hono";
import type { ApiEnv } from "@/utils/interface";
import { rawVerifyChatBackend } from "@/services/chat-platform";

export function requireChatMachine(storage = false): MiddlewareHandler<ApiEnv> {
  return async (context, next) => {
    await rawVerifyChatBackend(context.req.raw, storage);
    await next();
  };
}
