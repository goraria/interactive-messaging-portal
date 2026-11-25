import type { UpgradeWebSocket } from "hono/ws";
import type { MiddlewareHandler } from "hono";
import { rawReadAppIdentity } from "@/models/session";
import { rawReadConversationSignal } from "@/services/realtime";
import { rawIncomingChatCalls } from "@/models/chat-call";
import { createRealtimeConnection } from "@/lib/realtime/connection";
import { subscribeRealtimeInvalidation } from "@/lib/realtime/invalidation";
import type { Context } from "hono";
import type { ApiEnv } from "@/utils/interface";
import { rawCheckCurrentConversationAccess } from "@/models/index"
import { chatId } from "@/schemas/chat-domain";
import { rawCreateConversationToken as createConversationTokenServices } from "@/services/realtime";
import { rawGetCurrentUserRow } from "@/models/user";
import { getParam, getVerifiedUser } from "@/utils/controller";

export async function actCreateConversationToken(context: Context<ApiEnv>) {
  try {
    const authUser = getVerifiedUser(context);
    if (!authUser) return context.json({ error: "unauthorized" }, 401);
    const user = await rawGetCurrentUserRow(authUser);
    const conversationId = chatId.parse(getParam(context, "id"));
    await rawCheckCurrentConversationAccess(conversationId, user.id);
    return context.json(
      { data: await createConversationTokenServices(conversationId) },
      200,
    );
  } catch (error) {
    throw error;
  }
}

export function actCreateSocketHandlers<Socket>(
  upgradeWebSocket: UpgradeWebSocket<Socket>,
) {
  let connections = 0;
  const users = new Map<string, number>();
  function handler(incoming = false): MiddlewareHandler<ApiEnv> {
    return async (context, next) => {
      const authUser = getVerifiedUser(context);
      if (!authUser) return context.json({ error: "unauthorized" }, 401);
      const parsed = chatId.safeParse(context.req.param("id"));
      if (!parsed.success)
        return context.json({ error: "invalid_conversation" }, 400);
      const user = await rawGetCurrentUserRow(authUser);
      const conversationId = parsed.data;
      await rawReadConversationSignal(conversationId, user.id);
      if (connections >= 500 || (users.get(user.id) ?? 0) >= 5)
        return context.json({ error: "connection_limit" }, 429);
      connections++;
      users.set(user.id, (users.get(user.id) ?? 0) + 1);
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        connections--;
        const count = (users.get(user.id) ?? 1) - 1;
        if (count) users.set(user.id, count);
        else users.delete(user.id);
      };
      const headers = new Headers(context.req.raw.headers);
      const events = createRealtimeConnection({
        conversationId,
        subscribe: (wake) =>
          subscribeRealtimeInvalidation(conversationId, wake),
        readSignal: incoming
          ? async () => {
              await rawReadConversationSignal(conversationId, user.id);
              return JSON.stringify({
                type: "chat.call",
                calls: await rawIncomingChatCalls(user.id, conversationId),
              });
            }
          : () => rawReadConversationSignal(conversationId, user.id),
        serializeSignal: incoming ? (snapshot) => snapshot : undefined,
        reauthorize: async () =>
          (await rawReadAppIdentity(headers))?.user.id === user.id,
        onClose: release,
      });
      try {
        const response = await upgradeWebSocket(() => events)(context, next);
        if (!response || response.status >= 400) release();
        return response;
      } catch (error) {
        release();
        throw error;
      }
    };
  }
  return { chat: handler(), call: handler(true) };
}
