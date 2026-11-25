import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ caller: vi.fn() }));
vi.mock("@/utils/caller", () => ({ caller: api.caller }));
import { subscribeIncomingCalls } from "@/lib/realtime/call-client";
class Socket {
  static instances: Socket[] = [];
  onmessage?: (event: { data: string }) => void;
  onerror?: () => void;
  onclose?: (event: { code: number }) => void;
  send = vi.fn();
  close = vi.fn(() => this.onclose?.({ code: 1000 }));
  constructor(readonly url: URL) {
    Socket.instances.push(this);
  }
}
const cleanup: (() => void)[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", { location: { origin: "https://chat.example" } });
  vi.stubGlobal("WebSocket", Socket);
  Socket.instances = [];
  api.caller.mockReset();
});
afterEach(() => {
  for (const stop of cleanup.splice(0)) stop();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const call = {
  id: "11111111-1111-4111-8111-111111111111",
  conversationId: "room",
  callerId: "other",
  calleeId: "user",
  kind: "audio",
  state: "ringing",
  expiresAt: "2026-11-11T12:00:00Z",
  createdAt: "2026-11-11T11:59:00Z",
  endedAt: null,
};
const emit = (socket: Socket, calls: unknown[]) =>
  socket.onmessage!({ data: JSON.stringify({ type: "chat.call", calls }) });
it("shares one authenticated socket between header and incoming UI, without idle REST polling", async () => {
  const a = vi.fn(),
    b = vi.fn();
  cleanup.push(
    subscribeIncomingCalls("room", "user", a),
    subscribeIncomingCalls("room", "user", b),
  );
  expect(Socket.instances).toHaveLength(1);
  const socket = Socket.instances[0]!;
  expect(socket.url.href).toBe("wss://chat.example/external/socket/room/call");
  emit(socket, []);
  await vi.advanceTimersByTimeAsync(300000);
  expect(api.caller).not.toHaveBeenCalled();
  expect(Socket.instances).toHaveLength(1);
  emit(socket, [call]);
  expect(a).toHaveBeenLastCalledWith([call]);
  expect(b).toHaveBeenLastCalledWith([call]);
  emit(socket, []);
  expect(a).toHaveBeenLastCalledWith([]);
});
it("keeps subscriptions account-scoped and closes only when the last consumer leaves", () => {
  const stopA = subscribeIncomingCalls("room", "user", vi.fn());
  const stopB = subscribeIncomingCalls("room", "user", vi.fn());
  const other = vi.fn();
  const stopOther = subscribeIncomingCalls("other-room", "other", other);
  cleanup.push(stopOther);
  emit(Socket.instances[0]!, [call]);
  expect(other).not.toHaveBeenCalledWith([call]);
  stopA();
  expect(Socket.instances[0]!.close).not.toHaveBeenCalled();
  stopB();
  expect(Socket.instances[0]!.close).toHaveBeenCalledOnce();
});
it.each([
  ["other-room", "user"],
  ["room", "other-user"],
])(
  "isolates subscriptions for conversation %s and account %s",
  (conversationId, userId) => {
    const first = vi.fn(),
      other = vi.fn();
    cleanup.push(subscribeIncomingCalls("room", "user", first));
    cleanup.push(subscribeIncomingCalls(conversationId, userId, other));
    expect(Socket.instances).toHaveLength(2);
    emit(Socket.instances[0]!, [call]);
    expect(other).not.toHaveBeenCalledWith([call]);
  },
);

it("ignores call snapshots belonging to another conversation", () => {
  const listener = vi.fn();
  cleanup.push(subscribeIncomingCalls("room", "user", listener));
  emit(Socket.instances[0]!, [{ ...call, conversationId: "another-room" }]);
  expect(listener).toHaveBeenLastCalledWith([]);
});

it("handles heartbeat and reconnect without calling call APIs", async () => {
  const listener = vi.fn();
  cleanup.push(subscribeIncomingCalls("room", "user", listener));
  const first = Socket.instances[0]!;
  emit(first, []);
  first.onmessage!({ data: '{"type":"ping"}' });
  expect(first.send).toHaveBeenCalledWith('{"type":"pong"}');
  first.onclose!({ code: 1006 });
  await vi.advanceTimersByTimeAsync(1000);
  expect(Socket.instances).toHaveLength(2);
  emit(Socket.instances[1]!, [call]);
  expect(listener).toHaveBeenLastCalledWith([call]);
  expect(api.caller).not.toHaveBeenCalled();
});
it("rejects malformed snapshots and stops retrying after revocation", async () => {
  const listener = vi.fn();
  cleanup.push(subscribeIncomingCalls("room", "user", listener));
  const socket = Socket.instances[0]!;
  emit(socket, [{ ...call, kind: "invalid-kind" }]);
  expect(listener).toHaveBeenCalledTimes(1);
  socket.onclose!({ code: 4401 });
  await vi.advanceTimersByTimeAsync(60000);
  expect(Socket.instances).toHaveLength(1);
  expect(api.caller).not.toHaveBeenCalled();
});
