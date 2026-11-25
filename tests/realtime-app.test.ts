import { beforeEach, expect, it, vi } from "vitest";
import type { WSEvents, UpgradeWebSocket, WSContext } from "hono/ws";
import { WSContext as SocketContext } from "hono/ws";
import type { MiddlewareHandler } from "hono";
import type { ApiEnv } from "@/utils/interface";
const state = vi.hoisted(() => ({
  auth: vi.fn(),
  signal: vi.fn(),
  identity: vi.fn(),
  current: vi.fn(),
  incoming: vi.fn(),
}));
vi.mock("@/utils/environment", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/environment")>()),
  appUrl: "https://chat.example",
  rateLimitEnabled: false,
}));
vi.mock("@/middlewares/auth", () => ({ requireAuth: () => state.auth }));
vi.mock("@/models/user", () => ({ rawGetCurrentUserRow: state.current }));
vi.mock("@/services/realtime", () => ({
  rawReadConversationSignal: state.signal,
}));
vi.mock("@/models/session", () => ({ rawReadAppIdentity: state.identity }));
vi.mock("@/models/chat-call", () => ({ rawIncomingChatCalls: state.incoming }));
import { createRealtimeApp } from "@/lib/realtime/app";
const room = "11111111-1111-4111-8111-111111111111";
let handlers: WSEvents[];
let upgrade: UpgradeWebSocket;
beforeEach(() => {
  handlers = [];
  state.auth.mockReset().mockImplementation(async (c, next) => {
    c.set("auth", { user: { id: "sso-user", email: "member@example.test" } });
    await next();
  });
  state.signal.mockReset().mockResolvedValue("1");
  state.identity.mockReset().mockResolvedValue({ user: { id: "local-user" } });
  state.current.mockReset().mockResolvedValue({ id: "local-user" });
  state.incoming.mockReset().mockResolvedValue([]);
  upgrade = ((factory: (c: unknown) => WSEvents) =>
    (async (c) => {
      handlers.push(factory(c));
      return new Response(null);
    }) as MiddlewareHandler<ApiEnv>) as UpgradeWebSocket;
});
const request = (
  origin: string | null = "https://chat.example",
  id = room,
  kind = "chat",
) =>
  new Request(`https://chat.example/external/socket/${id}/${kind}`, {
    headers: {
      ...(origin ? { origin } : {}),
      upgrade: "websocket",
      cookie: "gorth.session_token=fixture",
    },
  });
it.each([null, "https://attacker.example", "null"])(
  "rejects origin %s before session access",
  async (origin) => {
    expect(
      (await createRealtimeApp(upgrade).fetch(request(origin))).status,
    ).toBe(403);
    expect(state.auth).not.toHaveBeenCalled();
  },
);
it("requires a WebSocket upgrade and refuses bearer authentication", async () => {
  const app = createRealtimeApp(upgrade);
  const plain = request();
  plain.headers.delete("upgrade");
  expect((await app.fetch(plain)).status).toBe(426);
  const bearer = request();
  bearer.headers.set("authorization", "Bearer fixture");
  expect((await app.fetch(bearer)).status).toBe(401);
});
it("preserves the existing session middleware denial", async () => {
  state.auth.mockImplementation((c) => c.json({ error: "unauthorized" }, 401));
  expect((await createRealtimeApp(upgrade).fetch(request())).status).toBe(401);
  expect(handlers).toHaveLength(0);
});
it.each(["chat", "call"])(
  "rejects invalid IDs and non-members before %s upgrade",
  async (kind) => {
    const app = createRealtimeApp(upgrade);
    expect(
      (await app.fetch(request("https://chat.example", "invalid", kind)))
        .status,
    ).toBe(400);
    state.signal.mockRejectedValue(
      Object.assign(new Error("forbidden"), { statusCode: 403 }),
    );
    expect(
      (await app.fetch(request("https://chat.example", room, kind))).status,
    ).toBe(403);
    expect(handlers).toHaveLength(0);
  },
);
it("caps connections per user and releases capacity on close", async () => {
  const app = createRealtimeApp(upgrade);
  for (let i = 0; i < 5; i++)
    expect((await app.fetch(request())).status).toBe(200);
  expect((await app.fetch(request())).status).toBe(429);
  handlers[0]!.onClose!(new CloseEvent("close"), {} as WSContext);
  expect((await app.fetch(request())).status).toBe(200);
});
it("releases capacity when the adapter fails to upgrade", async () => {
  const reject = (() => () =>
    new Response(null, { status: 400 })) as unknown as UpgradeWebSocket;
  const app = createRealtimeApp(reject);
  for (let i = 0; i < 7; i++)
    expect((await app.fetch(request())).status).toBe(400);
});

it("scopes incoming calls to the authorized conversation without accepting a requested identity", async () => {
  vi.useFakeTimers();
  const send = vi.fn();
  const ws = new SocketContext({ send, close: vi.fn(), readyState: 1 });
  try {
    const response = await createRealtimeApp(upgrade).fetch(
      new Request(
        "https://chat.example/external/socket/" + room + "/call?userId=attacker",
        { headers: request().headers },
      ),
    );
    expect(response.status).toBe(200);
    handlers[0]!.onOpen!(new Event("open"), ws);
    await vi.advanceTimersByTimeAsync(0);
    expect(state.incoming).toHaveBeenCalledWith("local-user", room);
    expect(JSON.parse(send.mock.calls[0]![0])).toEqual({
      type: "chat.call",
      calls: [],
    });
    expect(state.signal).toHaveBeenCalledWith(room, "local-user");
  } finally {
    handlers[0]?.onClose?.(new CloseEvent("close"), ws);
    vi.useRealTimers();
  }
});
