/** Next owns its HTTP port; Hono uses a private port behind the same-origin rewrite. */
export function resolveWebsocketListenerPort(port: number, appUrl: string) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error("Invalid NEXT_WEBSOCKET_PORT")
  const origin = appUrl ? new URL(appUrl) : new URL("http://localhost:3030")
  const httpPort = Number(origin.port || (origin.protocol === "https:" ? 443 : 80))
  if (port !== httpPort) return port
  // Preserve the existing private listener when public HTTP and WS share 3030.
  return httpPort === 3037 ? 3038 : 3037
}
