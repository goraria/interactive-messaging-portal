import type { WSEvents, WSContext } from "hono/ws"

export interface RealtimeConnectionOptions {
  conversationId: string
  readSignal: () => Promise<string>
  serializeSignal?: (signal: string) => string
  reauthorize: () => Promise<boolean>
  onClose: () => void
  subscribe?: (wake: () => void) => () => void
  intervalMs?: number
  reauthorizeMs?: number
}

export function createRealtimeConnection(
  options: RealtimeConnectionOptions
): WSEvents {
  let socket: WSContext | undefined
  let timer: ReturnType<typeof setInterval> | undefined
  let busy = false
  let refreshAgain = false
  let unsubscribe: (() => void) | undefined
  let closed = false
  let sequence: string | undefined
  let authorizedAt = 0
  let awaitingPong = false
  let heartbeatAt = Date.now()
  const terminate = () =>
    (socket?.raw as { terminate?: () => void } | undefined)?.terminate?.()
  const cleanup = () => {
    if (closed) return
    closed = true
    clearInterval(timer)
    unsubscribe?.()
    options.onClose()
  }
  const close = (code: number, reason: string) => {
    cleanup()
    socket?.close(code, reason)
    // ws otherwise waits for a dead peer's close handshake.
    const timeout = setTimeout(terminate, 1000)
    timeout.unref?.()
  }
  const tick = async () => {
    if (closed || !socket) return
    if (busy) {
      refreshAgain = true
      return
    }
    busy = true
    const deadline = setTimeout(() => close(1013, "realtime_timeout"), 10000)
    try {
      const now = Date.now()
      if (now - authorizedAt >= (options.reauthorizeMs ?? 15000)) {
        if (!(await options.reauthorize()))
          return close(4401, "session_expired")
        authorizedAt = now
      }
      if (closed) return
      const latest = await options.readSignal()
      if (closed) return
      // Close slow readers instead of growing an unbounded send queue.
      if (
        ((socket.raw as { bufferedAmount?: number } | undefined)
          ?.bufferedAmount ?? 0) > 65536
      )
        return close(1013, "slow_reader")
      if (latest !== sequence) {
        socket.send(
          options.serializeSignal?.(latest) ??
            JSON.stringify({
              type: "chat.changed",
              conversationId: options.conversationId,
              sequence: latest,
            })
        )
        sequence = latest
      }
      if (now - heartbeatAt >= 15000) {
        if (awaitingPong) return close(1001, "heartbeat_timeout")
        socket.send('{"type":"ping"}')
        awaitingPong = true
        heartbeatAt = now
      }
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode
      close(
        status === 403 || status === 404 ? 4403 : 1013,
        "realtime_unavailable"
      )
    } finally {
      clearTimeout(deadline)
      busy = false
      if (refreshAgain && !closed) {
        refreshAgain = false
        void tick()
      }
    }
  }
  return {
    onOpen(_event, ws) {
      socket = ws
      unsubscribe = options.subscribe?.(() => void tick())
      timer = setInterval(() => void tick(), options.intervalMs ?? 1000)
      void tick()
    },
    onMessage(event) {
      // Connections are subscribe-only; HTTP remains the only mutation path.
      if (event.data === '{"type":"pong"}' && awaitingPong) awaitingPong = false
      else close(1008, "subscribe_only")
    },
    onClose: cleanup,
    onError: () => close(1011, "socket_error"),
  }
}
