import { Realtime } from "ably"

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
