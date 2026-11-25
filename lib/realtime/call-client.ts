import { callSchema, type MessengerCall } from "@/schemas/client/messenger";

interface CallSubscription {
  listeners: Set<(calls: MessengerCall[]) => void>;
  calls: MessengerCall[];
  socket?: WebSocket;
  retry?: ReturnType<typeof setTimeout>;
  handshake?: ReturnType<typeof setTimeout>;
  stop: () => void;
}
const subscriptions = new Map<string, CallSubscription>();

/** Shared per account and conversation; no idle call REST polling. */
export function subscribeIncomingCalls(
  conversationId: string,
  userId: string,
  listener: (calls: MessengerCall[]) => void,
) {
  const key = JSON.stringify([userId, conversationId]);
  let entry = subscriptions.get(key);
  if (!entry) {
    let stopped = false,
      attempt = 0;
    entry = { listeners: new Set(), calls: [], stop: () => {} };
    const current = entry;
    const publish = (calls: MessengerCall[]) => {
      current.calls = calls;
      for (const callback of current.listeners) callback(calls);
    };
    const connect = () => {
      if (stopped) return;
      const url = new URL(
        "/external/socket/" + encodeURIComponent(conversationId) + "/call",
        window.location.origin,
      );
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      let socket: WebSocket;
      try {
        socket = new WebSocket(url);
      } catch {
        current.retry = setTimeout(
          connect,
          Math.min(30000, 1000 * 2 ** Math.min(attempt++, 5)),
        );
        return;
      }
      current.socket = socket;
      current.handshake = setTimeout(() => socket.close(), 10000);
      socket.onmessage = (event) => {
        if (
          stopped ||
          current.socket !== socket ||
          typeof event.data !== "string"
        )
          return;
        if (event.data === '{"type":"ping"}') {
          socket.send('{"type":"pong"}');
          return;
        }
        try {
          const frame = JSON.parse(event.data);
          if (frame?.type !== "chat.call") return;
          const calls = callSchema.array().max(10).safeParse(frame.calls);
          if (!calls.success) return;
          clearTimeout(current.handshake);
          attempt = 0;
          publish(
            calls.data.filter((call) => call.conversationId === conversationId),
          );
        } catch {
          /* Ignore malformed frames; never turn them into API requests. */
        }
      };
      socket.onclose = (event) => {
        clearTimeout(current.handshake);
        if (stopped || current.socket !== socket) return;
        publish([]);
        if (event.code === 4401 || event.code === 4403) return;
        current.retry = setTimeout(
          connect,
          Math.min(30000, 1000 * 2 ** Math.min(attempt++, 5)),
        );
      };
      socket.onerror = () => socket.close();
    };
    current.stop = () => {
      stopped = true;
      clearTimeout(current.retry);
      clearTimeout(current.handshake);
      current.socket?.close(1000, "unmount");
      subscriptions.delete(key);
    };
    subscriptions.set(key, current);
    connect();
  }
  const current = entry;
  current.listeners.add(listener);
  listener(current.calls);
  return () => {
    current.listeners.delete(listener);
    if (!current.listeners.size) current.stop();
  };
}
