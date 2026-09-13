import { Realtime } from "@gorth/structure/cores/ably/index"

export function getMessageChannelName(conversationId: string) {
  return `chat:message:${conversationId}`
}

export function createAblyClient(conversationId: string) {
  return new Realtime({
    authUrl: `/chat/conversations/${encodeURIComponent(conversationId)}/realtime/token`,
    authMethod: "GET",
    autoConnect: false,
  })
}
