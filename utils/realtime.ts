export function conversationSocketPath(id: string) {
  return `/external/socket/${encodeURIComponent(id)}/chat`;
}

export interface RealtimeSignal {
  type: "chat.changed";
  conversationId: string;
  sequence: string;
}

export function parseRealtimeSignal(
  value: unknown,
  conversationId: string,
): RealtimeSignal | null {
  if (!value || typeof value !== "object") return null;
  const signal = value as Partial<RealtimeSignal>;
  if (
    signal.type !== "chat.changed" ||
    signal.conversationId !== conversationId ||
    typeof signal.sequence !== "string" ||
    !/^\d{1,19}$/.test(signal.sequence)
  )
    return null;
  return { type: signal.type, conversationId, sequence: signal.sequence };
}
