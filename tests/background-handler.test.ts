import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  handle: vi.fn(),
  after: vi.fn(),
  enqueue: vi.fn(),
  realtime: vi.fn(),
  invalidate: vi.fn(),
}));
vi.mock("next/server", () => ({ after: state.after }));
vi.mock("@/utils/environment", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/environment")>()),
  appUrl: "https://chat.example",
  rateLimitEnabled: false,
  isProduction: true,
}));
vi.mock("@/services/background", () => ({
  rawEnqueueBackgroundJob: state.enqueue,
}));
vi.mock("@/models/chat-delivery", () => ({
  rawDispatchChatEvents: state.realtime,
}));
vi.mock("@/lib/realtime/invalidation", () => ({
  invalidateRealtimeConversation: state.invalidate,
}));

import type { Context, Next } from "hono";
vi.mock("@/middlewares/auth", () => ({
  requireAuth: () => async (_context: Context, next: Next) => {
    await next();
  },
}));
vi.mock("@/middlewares/session", () => ({
  requireAppSession: () => async (_context: Context, next: Next) => {
    await next();
  },
}));
vi.mock("@/controllers/chat", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/controllers/chat")>()),
  actSendChatMessage: (context: Context) => state.handle(context.req.raw),
  actListChatMessages: (context: Context) => state.handle(context.req.raw),
}));
vi.mock("@/controllers/platform", () => ({
  actForwardPlatform: (context: Context) => state.handle(context.req.raw),
}));
vi.mock("@/lib/auth/server", () => ({
  authServer: { handler: state.handle },
}));
import {
  GET as messageGET,
  POST as messagePOST,
} from "@/app/(api)/internal/[[...route]]/route";
import { POST as authPOST } from "@/app/(api)/auth/[[...route]]/route";
import { POST as resourcePOST } from "@/app/(api)/external/[[...route]]/route";
import { recordRealtimeMutation } from "@/lib/realtime/mutation";

const GET = messageGET;
const POST = messagePOST;

beforeEach(() => {
  state.handle.mockReset().mockImplementation(() => {
    recordRealtimeMutation("fixture-conversation");
    return new Response(null, { status: 201 });
  });
  state.after.mockReset();
  state.enqueue.mockReset().mockResolvedValue(undefined);
  state.realtime.mockReset().mockResolvedValue({ claimed: 0, failed: 0 });
  state.invalidate.mockReset();
});

it.each([201, 403])(
  "publishes recorded realtime wakeups only after success (%i)",
  async (status) => {
    state.handle.mockImplementationOnce(() => {
      recordRealtimeMutation("fixture-conversation");
      return new Response(null, { status });
    });
    const response = await POST(
      new Request("https://chat.example/internal/conversation/fixture/message", {
        method: "POST",
        headers: { Origin: "https://chat.example" },
      }),
    );
    expect(response.status).toBe(status);
    if (status === 201) {
      expect(state.invalidate).toHaveBeenCalledExactlyOnceWith(
        "fixture-conversation",
      );
      expect(state.after).toHaveBeenCalledOnce();
    } else {
      expect(state.invalidate).not.toHaveBeenCalled();
      expect(state.after).not.toHaveBeenCalled();
    }
  },
);

it("rejects cross-origin cookie mutations before the domain handler", async () => {
  const response = await POST(
    new Request("https://chat.example/internal/conversation/fixture/message", {
      method: "POST",
      headers: {
        Origin: "https://attacker.example",
        Cookie: "session=fixture",
      },
    }),
  );
  expect(response.status).toBe(403);
  expect(state.handle).not.toHaveBeenCalled();
  expect(state.after).not.toHaveBeenCalled();
});

it("enqueues after the concrete message route commits its successful response", async () => {
  const response = await POST(
    new Request("https://chat.example/internal/conversation/fixture/message", {
      method: "POST",
      headers: { Origin: "https://chat.example" },
    }),
  );
  expect(response.status).toBe(201);
  expect(state.enqueue).not.toHaveBeenCalled();
  expect(state.after).toHaveBeenCalledOnce();
  await state.after.mock.calls[0]![0]();
  expect(state.enqueue).toHaveBeenCalledOnce();
  expect(state.realtime).toHaveBeenCalledWith(undefined, "realtime");
});

it("keeps native auth responses intact without scheduling Chat mutations", async () => {
  const request = new Request(
    "https://chat.example/auth/callback/gorth?code=fixture&state=fixture",
    {
      method: "POST",
    },
  );
  state.handle.mockResolvedValueOnce(
    new Response(null, {
      status: 302,
      headers: {
        Location: "/account",
        "Set-Cookie": "fixture=session; HttpOnly; Path=/",
      },
    }),
  );
  const response = await authPOST(request);
  expect(state.handle).toHaveBeenCalledWith(request);
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe("/account");
  expect(response.headers.get("set-cookie")).toBe(
    "fixture=session; HttpOnly; Path=/",
  );
  expect(state.after).not.toHaveBeenCalled();
});

it("does not schedule Chat jobs for platform writes without a committed Chat event", async () => {
  state.handle.mockResolvedValueOnce(new Response(null, { status: 201 }));
  const request = new Request("https://chat.example/external/resource/comment", {
    method: "POST",
    headers: { Origin: "https://chat.example" },
  });
  expect((await resourcePOST(request)).status).toBe(201);
  expect(state.handle).toHaveBeenCalledWith(request);
  expect(state.after).not.toHaveBeenCalled();
  expect(state.enqueue).not.toHaveBeenCalled();
  expect(state.realtime).not.toHaveBeenCalled();
});

it("starts realtime delivery even while Queue enqueue is stalled", async () => {
  let release!: () => void;
  state.enqueue.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      release = resolve;
    }),
  );
  await POST(
    new Request("https://chat.example/internal/conversation/fixture/message", {
      method: "POST",
      headers: { Origin: "https://chat.example" },
    }),
  );
  const background = state.after.mock.calls[0]![0]();
  expect(state.realtime).toHaveBeenCalledOnce();
  release();
  await background;
});

it("keeps Queue recovery when immediate realtime delivery fails", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  state.realtime.mockResolvedValueOnce({ claimed: 1, failed: 1 });
  await POST(
    new Request("https://chat.example/internal/conversation/fixture/message", {
      method: "POST",
      headers: { Origin: "https://chat.example" },
    }),
  );
  await state.after.mock.calls[0]![0]();
  expect(state.enqueue).toHaveBeenCalledOnce();
  expect(log).toHaveBeenCalledWith(
    "[background] realtime_deferred; outbox retained for recovery",
  );
});

it.each([
  ["GET", "/conversation/fixture/message", 200],
  ["POST", "/conversation/fixture/message", 403],
  ["POST", "/auth/sign-in/social", 200],
  ["POST", "/auth", 200],
])("does not enqueue %s %s with status %i", async (method, path, status) => {
  state.handle.mockResolvedValueOnce(new Response(null, { status }));
  await (path.startsWith("/auth") ? authPOST : method === "GET" ? GET : POST)(
    new Request("https://chat.example" + path, {
      method,
      headers: { Origin: "https://chat.example" },
    }),
  );
  expect(state.after).not.toHaveBeenCalled();
});

it("preserves the committed response if Queue is unavailable; Cron can recover the outbox", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  state.enqueue.mockRejectedValueOnce(new Error("queue offline"));
  const response = await POST(
    new Request("https://chat.example/internal/conversation/fixture/message", {
      method: "POST",
      headers: { Origin: "https://chat.example" },
    }),
  );
  await expect(state.after.mock.calls[0]![0]()).resolves.toBeUndefined();
  expect(response.status).toBe(201);
  expect(log).toHaveBeenCalledWith(
    "[background] enqueue_failed; outbox retained for recovery",
    { category: "queue_unavailable", status: undefined },
  );
});
