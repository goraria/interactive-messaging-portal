import "server-only";
import {
  createAdaptorServer,
  upgradeWebSocket,
  type ServerType,
} from "@hono/node-server";
import { WebSocketServer } from "ws";
import { createRealtimeApp } from "@/lib/realtime/app";
import { appUrl, websocketPort } from "@/utils/environment";
import { resolveWebsocketListenerPort } from "@/utils/realtime-port";

interface RealtimeListener {
  server: ServerType;
  sockets: WebSocketServer;
}
const state = globalThis as typeof globalThis & {
  chatRealtimeListener?: RealtimeListener;
  chatRealtimeStartup?: Promise<ServerType>;
};

async function openRealtimeServer() {
  const listenerPort = resolveWebsocketListenerPort(websocketPort, appUrl);
  const sockets = new WebSocketServer({
    noServer: true,
    maxPayload: 1024,
    perMessageDeflate: false,
  });
  try {
    const app = createRealtimeApp(upgradeWebSocket);
    const server = createAdaptorServer({
      fetch: app.fetch,
      // Preserve Request/Response globals used by Next and authentication.
      overrideGlobalObjects: false,
      websocket: { server: sockets },
    });
    state.chatRealtimeListener = { server, sockets };
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        server.removeListener("error", failed);
        server.removeListener("close", closed);
      };
      const failed = (error: Error) => {
        cleanup();
        reject(error);
      };
      const closed = () =>
        failed(new Error("Realtime listener closed during startup"));
      server.once("error", failed);
      server.once("close", closed);
      server.listen(listenerPort, "127.0.0.1", () => {
        cleanup();
        resolve();
      });
    });
    server.unref();
    server.on("error", () => console.error("[realtime] listener_error"));
    process.once("SIGTERM", stopRealtimeServer);
    process.once("SIGINT", stopRealtimeServer);
    // console.info(
    //   "[realtime] Hono + ws listening on loopback:" + listenerPort
    // )
    return server;
  } catch (error) {
    if (state.chatRealtimeListener?.sockets === sockets) stopRealtimeServer();
    else sockets.close();
    throw error;
  }
}

export function startRealtimeServer(): Promise<ServerType> {
  // Cache pending startup too, preventing two instrumentation calls racing a bind.
  state.chatRealtimeStartup ??= Promise.resolve()
    .then(openRealtimeServer)
    .catch((error) => {
      delete state.chatRealtimeStartup;
      throw error;
    });
  return state.chatRealtimeStartup;
}

export function stopRealtimeServer() {
  const listener = state.chatRealtimeListener;
  delete state.chatRealtimeStartup;
  delete state.chatRealtimeListener;
  process.removeListener("SIGTERM", stopRealtimeServer);
  process.removeListener("SIGINT", stopRealtimeServer);
  if (!listener) return;
  for (const socket of listener.sockets.clients) socket.terminate();
  listener.sockets.close();
  listener.server.close();
}
