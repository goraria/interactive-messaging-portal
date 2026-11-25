import {
  conversationSocketPath,
  parseRealtimeSignal,
  type RealtimeSignal,
} from "@/utils/realtime";
import { messengerRealtimeConnection } from "@/queries/messenger";

export function subscribeConversation(options: {
  conversationId: string;
  onSignal: (signal: RealtimeSignal) => void;
  onReady: () => void;
  onUnavailable: () => void;
  onForbidden: () => void;
}) {
  let socket: WebSocket | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let handshake: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let connecting = false;
  let attempt = 0;
  const connect = async () => {
    if (stopped || connecting) return;
    connecting = true;
    // Browsers do not expose failed-upgrade HTTP statuses. Preflight through the
    // existing protected HTTP endpoint to distinguish revoked access from outages.
    try {
      const connection = await messengerRealtimeConnection(
        options.conversationId,
      );
      if (stopped) {
        connecting = false;
        return;
      }
      if (connection.url !== conversationSocketPath(options.conversationId))
        throw new Error("Invalid socket path");
    } catch (error) {
      connecting = false;
      if (stopped) return;
      const status =
        (error as { status?: number; response?: { status?: number } }).status ??
        (error as { response?: { status?: number } }).response?.status;
      if (status === 401 || status === 403 || status === 404) {
        stopped = true;
        options.onForbidden();
      } else {
        options.onUnavailable();
        schedule();
      }
      return;
    }
    const url = new URL(
      conversationSocketPath(options.conversationId),
      window.location.origin,
    );
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    try {
      socket = new WebSocket(url);
      connecting = false;
    } catch {
      connecting = false;
      options.onUnavailable();
      schedule();
      return;
    }
    const current = socket;
    handshake = setTimeout(() => current.close(), 10000);
    current.onmessage = (event) => {
      if (stopped || socket !== current || typeof event.data !== "string")
        return;
      try {
        if (event.data === '{"type":"ping"}') {
          current.send('{"type":"pong"}');
          return;
        }
        const signal = parseRealtimeSignal(
          JSON.parse(event.data),
          options.conversationId,
        );
        if (!signal) return;
        clearTimeout(handshake);
        attempt = 0;
        options.onReady();
        options.onSignal(signal);
      } catch {
        /* Ignore malformed/unrelated server frames; HTTP replay stays authoritative. */
      }
    };
    current.onerror = () => {
      if (!stopped) options.onUnavailable();
    };
    current.onclose = (event) => {
      clearTimeout(handshake);
      if (stopped || socket !== current) return;
      if (event.code === 4401 || event.code === 4403) {
        stopped = true;
        options.onForbidden();
        return;
      }
      options.onUnavailable();
      schedule();
    };
  };
  const schedule = () => {
    if (!stopped)
      timer = setTimeout(
        () => void connect(),
        Math.min(30000, 500 * 2 ** Math.min(attempt++, 6)) +
          Math.floor(Math.random() * 250),
      );
  };
  const online = () => {
    if (!stopped && (!socket || socket.readyState === WebSocket.CLOSED)) {
      clearTimeout(timer);
      void connect();
    }
  };
  window.addEventListener("online", online);
  void connect();
  return () => {
    stopped = true;
    clearTimeout(timer);
    clearTimeout(handshake);
    window.removeEventListener("online", online);
    socket?.close(1000, "unmount");
  };
}
