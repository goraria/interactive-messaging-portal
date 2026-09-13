/**
 * Compatibility re-exports for legacy imports.
 * Prefer importing directly from @/lib/utils/conversation.
 */
export {
  toChatConversation,
  getConversationPeer,
  shouldShowHeader,
} from "@/lib/utils/conversation"

/**
 * Reads a dynamic route param (string | string[] | undefined) → string.
 * Falls back to "" when the param is absent.
 */
export function readRouteId(param: string | string[] | undefined): string {
  if (!param) return ""
  return Array.isArray(param) ? (param[0] ?? "") : param
}
