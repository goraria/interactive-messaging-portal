// Shared between Next route bundles and the Hono listener in the same process.
// Only wakeups live here; the database remains the source of truth.
const state = globalThis as typeof globalThis & {
  chatRealtimeInvalidations?: Map<string, Set<() => void>>
}
function subscriptions() {
  return (state.chatRealtimeInvalidations ??= new Map())
}
export function subscribeRealtimeInvalidation(conversationId: string, listener: () => void) {
  const listeners = subscriptions().get(conversationId) ?? new Set()
  listeners.add(listener)
  subscriptions().set(conversationId, listeners)
  return () => {
    listeners.delete(listener)
    if (!listeners.size) subscriptions().delete(conversationId)
  }
}
export function invalidateRealtimeConversation(conversationId: string) {
  for (const listener of subscriptions().get(conversationId) ?? []) listener()
}
