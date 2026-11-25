import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { invalidateRealtimeConversation } from "@/lib/realtime/invalidation";

const state = globalThis as typeof globalThis & {
  chatRealtimeMutations?: AsyncLocalStorage<Set<string>>;
};
const mutations = (state.chatRealtimeMutations ??= new AsyncLocalStorage<
  Set<string>
>());

export function recordRealtimeMutation(conversationId: string) {
  mutations.getStore()?.add(conversationId);
}

export async function withRealtimeMutations(
  operation: () => Response | Promise<Response>,
  onCommitted?: () => void,
) {
  const affected = new Set<string>();
  const response = await mutations.run(affected, operation);
  // The Hono operation has finished its transactions before returning success.
  // Rolled-back or failed requests never publish a wakeup.
  if (response.ok && affected.size) {
    onCommitted?.();
    for (const conversationId of affected)
      invalidateRealtimeConversation(conversationId);
  }
  return response;
}
