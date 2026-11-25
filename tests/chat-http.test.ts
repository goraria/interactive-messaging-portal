import { beforeEach, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { ZodError } from "@gorth-com/structure/cores/zod";
const state = vi.hoisted(() => ({
  send: vi.fn(),
  start: vi.fn(),
  getMessage: vi.fn(),
  block: vi.fn(),
  signals: vi.fn(),
  finishUpload: vi.fn(),
  user: {
    id: "e10f949a-c19b-4df9-aed4-4a3dfaa19b01",
    externalUserId: "sso-caller",
    name: "Caller",
    email: "caller@example.test",
    status: "active",
  },
}));
vi.mock("@/middlewares/auth", () => ({
  requireAuth:
    () =>
    async (
      context: {
        req: { header: (name: string) => string | undefined };
        set: (name: string, value: unknown) => void;
        json: (data: unknown, status: number) => Response;
      },
      next: () => Promise<void>,
    ) => {
      if (context.req.header("x-test-identity") !== "caller")
        return context.json({ error: "unauthorized" }, 401);
      context.set("auth", {
        user: {
          id: state.user.externalUserId,
          email: state.user.email,
          name: state.user.name,
          status: "active",
        },
      });
      await next();
    },
}));
vi.mock("@/models/user", () => ({
  rawGetCurrentUserRow: async () => state.user,
}));
vi.mock("@/models/message", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/models/message")>()),
  rawSendChatMessage: state.send,
  rawGetChatMessage: state.getMessage,
}));
vi.mock("@/models/conversation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/models/conversation")>()),
  rawStartChatConversation: state.start,
  rawSetChatBlock: state.block,
}));
vi.mock("@/models/chat-call", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/models/chat-call")>()),
  rawListChatSignals: state.signals,
}));
vi.mock("@/services/chat-media", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/chat-media")>()),
  rawFinishChatUpload: state.finishUpload,
}));
import { conversationRoutes } from "@/routes/conversation";
import { messageRoutes } from "@/routes/message";
import { attachmentRoutes } from "@/routes/attachment";
import { blockRoutes } from "@/routes/block";
import { callRoutes } from "@/routes/call";
import { eventRoutes } from "@/routes/event";
import { internalRoutes } from "@/routes/internal";
const app = new Hono();
app.route("/conversation", conversationRoutes);
app.route("/message", messageRoutes);
app.route("/attachment", attachmentRoutes);
app.route("/block", blockRoutes);
app.route("/call", callRoutes);
app.route("/event", eventRoutes);
app.route("/internal", internalRoutes);
app.onError((error) => {
  const domain = error as { statusCode?: number; code?: string };
  return Response.json(
    { error: domain.code ?? "validation_failed" },
    { status: error instanceof ZodError ? 400 : (domain.statusCode ?? 500) },
  );
});
beforeEach(() => {
  state.send.mockReset().mockResolvedValue({ id: "sent" });
  state.start.mockReset().mockResolvedValue({ id: "conversation" });
  state.getMessage.mockReset().mockResolvedValue({ id: "message" });
  state.block.mockReset().mockResolvedValue({ blocked: true });
  state.signals.mockReset().mockResolvedValue([]);
  state.finishUpload.mockReset().mockResolvedValue({ complete: true });
});
const id = "e10f949a-c19b-4df9-aed4-4a3dfaa19b02";
const protectedRoutes = [
  ...new Map(
    app.routes
      .filter(
        (route) =>
          !route.path.includes("/dispatch") &&
          !route.path.includes("/internal/"),
      )
      .map((route) => {
        const path = route.path.replace(/:[^/]+/g, id);
        return [route.method + " " + path, [route.method, path] as const];
      }),
  ).values(),
];
it.each(protectedRoutes)(
  "requires an identity on %s %s",
  async (method, path) => {
    const response = await app.request(path!, {
      method,
      body: ["GET", "HEAD"].includes(method!) ? undefined : "{}",
      headers: { "Content-Type": "application/json" },
    });
    expect(response.status).toBe(401);
  },
);
it("uses the primary id param for message reads", async () => {
  const response = await app.request("/message/" + id, {
    headers: { "x-test-identity": "caller" },
  });
  expect(response.status).toBe(200);
  expect(state.getMessage).toHaveBeenCalledWith(id, state.user.id);
});

it("uses the primary id param for blocking", async () => {
  const response = await app.request("/block/" + id, {
    method: "POST",
    headers: { "x-test-identity": "caller" },
  });
  expect(response.status).toBe(200);
  expect(state.block).toHaveBeenCalledWith(state.user.id, id, true);
});

it("uses the primary id param for call signals and keeps query parsing", async () => {
  const response = await app.request("/call/" + id + "/signal?after=7", {
    headers: { "x-test-identity": "caller" },
  });
  expect(response.status).toBe(200);
  expect(state.signals).toHaveBeenCalledWith(id, state.user.id, "7");
});

it.each(["complete", "abort"])(
  "keeps uploadId separate from the parent id on %s",
  async (operation) => {
    const uploadId = "33333333-3333-4333-8333-333333333333";
    const response = await app.request(
      "/conversation/" + id + "/upload/" + uploadId + "/" + operation,
      {
        method: "POST",
        headers: {
          "x-test-identity": "caller",
          Authorization: "Bearer delegated-token",
        },
      },
    );
    expect(response.status).toBe(200);
    expect(state.finishUpload).toHaveBeenCalledWith(
      id,
      state.user.id,
      "delegated-token",
      uploadId,
      operation === "abort",
    );
  },
);

it("binds send identity and conversation to the verified actor, ignoring caller-supplied user IDs", async () => {
  const response = await app.request("/conversation/" + id + "/message", {
    method: "POST",
    headers: {
      "x-test-identity": "caller",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      clientMessageId: id,
      content: "hi",
      userId: "attacker",
      senderId: "attacker",
      type: "system",
    }),
  });
  expect(response.status).toBe(201);
  expect(state.send).toHaveBeenCalledWith(
    id,
    state.user.id,
    state.user.externalUserId,
    { clientMessageId: id, content: "hi", assetIds: [] },
  );
});
it("rejects invalid JSON, unsupported content type and overlong messages before persistence", async () => {
  const cases = [
    { body: "{", type: "application/json", status: 400 },
    { body: "{}", type: "text/plain", status: 415 },
    {
      body: JSON.stringify({ content: "x".repeat(4001), clientMessageId: id }),
      type: "application/json",
      status: 400,
    },
  ];
  for (const test of cases) {
    const response = await app.request("/conversation/" + id + "/message", {
      method: "POST",
      headers: { "x-test-identity": "caller", "Content-Type": test.type },
      body: test.body,
    });
    expect(response.status).toBe(test.status);
  }
  expect(state.send).not.toHaveBeenCalled();
});
it("removes the room auto-join entry point and raw arbitrary attachment creation", async () => {
  for (const path of [
    "/room/private-room/message",
    "/message/" + id + "/attachment",
  ])
    expect(
      (
        await app.request(path, {
          method: "POST",
          headers: {
            "x-test-identity": "caller",
            "Content-Type": "application/json",
          },
          body: "{}",
        })
      ).status,
    ).toBe(404);
  expect(state.send).not.toHaveBeenCalled();
});
it("rejects browser cookies on internal dispatch and credential endpoints", async () => {
  for (const path of ["/event/dispatch", "/internal/storage/credential"])
    expect(
      (
        await app.request(path, {
          method: "POST",
          headers: {
            Cookie: "session=user",
            "Content-Type": "application/json",
          },
          body: "{}",
        })
      ).status,
    ).toBe(403);
});
