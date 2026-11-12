import { expect, it } from "vitest"
import { resolveWebsocketListenerPort } from "@/utils/realtime-port"

it("shares the public Next origin using a distinct private listener", () => {
  expect(resolveWebsocketListenerPort(3030, "http://localhost:3030")).toBe(3037)
  expect(resolveWebsocketListenerPort(3037, "http://localhost:3037")).toBe(3038)
  expect(resolveWebsocketListenerPort(3030, "")).toBe(3037)
})
it("preserves an explicitly distinct listener port", () => {
  expect(resolveWebsocketListenerPort(4040, "http://localhost:3030")).toBe(4040)
})
it.each([0, 80, -1, 65536, NaN, 3030.5])("rejects invalid port %s", (port) => {
  expect(() => resolveWebsocketListenerPort(port, "http://localhost:3030"))
    .toThrow("Invalid NEXT_WEBSOCKET_PORT")
})
