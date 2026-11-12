import { beforeEach, expect, it, vi } from "vitest"
import { Hono } from "hono"
import { ZodError } from "@gorth-io/structure/cores/zod"
import type { ApiEnv } from "@/utils/interface"
const state = vi.hoisted(() => ({
  send: vi.fn(),
  start: vi.fn(),
  user: {
    id: "e10f949a-c19b-4df9-aed4-4a3dfaa19b01",
    externalUserId: "sso-caller",
    name: "Caller",
    email: "caller@example.test",
    status: "active",
  },
}))
vi.mock("@/middlewares/auth", () => ({
  requireAuth:
    () =>
    async (
      context: {
        req: { header: (name: string) => string | undefined }
        set: (name: string, value: unknown) => void
        json: (data: unknown, status: number) => Response
      },
      next: () => Promise<void>
    ) => {
      if (context.req.header("x-test-identity") !== "caller")
        return context.json({ error: "unauthorized" }, 401)
      context.set("auth", {
        user: {
          id: state.user.externalUserId,
          email: state.user.email,
          name: state.user.name,
          status: "active",
        },
      })
      await next()
    },
}))
vi.mock("@/services/users", () => ({
  getCurrentUserRow: async () => state.user,
}))
vi.mock("@/services/chat-messages", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/chat-messages")>()),
  sendChatMessage: state.send,
}))
vi.mock("@/services/chat-conversations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/chat-conversations")>()),
  startChatConversation: state.start,
}))
import { chatRoutes, chatInternalRoutes } from "@/routes/chat"
const app = new Hono<ApiEnv>()
app.route("/chat", chatRoutes())
app.route("/", chatInternalRoutes())
app.onError((error) => {
  const domain = error as { statusCode?: number; code?: string }
  return Response.json(
    { error: domain.code ?? "validation_failed" },
    { status: error instanceof ZodError ? 400 : (domain.statusCode ?? 500) }
  )
})
beforeEach(() => {
  state.send.mockReset().mockResolvedValue({ id: "sent" })
  state.start.mockReset().mockResolvedValue({ id: "conversation" })
})
const id = "e10f949a-c19b-4df9-aed4-4a3dfaa19b02"
const protectedRoutes = [
  ...new Map(
    app.routes
      .filter(
        (route) =>
          !route.path.includes("/dispatch") &&
          !route.path.includes("/internal/")
      )
      .map((route) => {
        const path = route.path.replace(/:[^/]+/g, id)
        return [route.method + " " + path, [route.method, path] as const]
      })
  ).values(),
]
it.each(protectedRoutes)(
  "requires an identity on %s %s",
  async (method, path) => {
    const response = await app.request(path!, {
      method,
      body: ["GET", "HEAD"].includes(method!) ? undefined : "{}",
      headers: { "Content-Type": "application/json" },
    })
    expect(response.status).toBe(401)
  }
)
it("binds send identity and conversation to the verified actor, ignoring caller-supplied user IDs", async () => {
  const response = await app.request("/chat/conversation/" + id + "/message", {
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
  })
  expect(response.status).toBe(201)
  expect(state.send).toHaveBeenCalledWith(
    id,
    state.user.id,
    state.user.externalUserId,
    { clientMessageId: id, content: "hi", assetIds: [] }
  )
})
it("rejects invalid JSON, unsupported content type and overlong messages before persistence", async () => {
  const cases = [
    { body: "{", type: "application/json", status: 400 },
    { body: "{}", type: "text/plain", status: 415 },
    {
      body: JSON.stringify({ content: "x".repeat(4001), clientMessageId: id }),
      type: "application/json",
      status: 400,
    },
  ]
  for (const test of cases) {
    const response = await app.request(
      "/chat/conversation/" + id + "/message",
      {
        method: "POST",
        headers: { "x-test-identity": "caller", "Content-Type": test.type },
        body: test.body,
      }
    )
    expect(response.status).toBe(test.status)
  }
  expect(state.send).not.toHaveBeenCalled()
})
it("removes the room auto-join entry point and raw arbitrary attachment creation", async () => {
  for (const path of [
    "/chat/room/private-room/message",
    "/chat/message/" + id + "/attachment",
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
      ).status
    ).toBe(404)
  expect(state.send).not.toHaveBeenCalled()
})
it("rejects browser cookies on internal dispatch and credential endpoints", async () => {
  for (const path of ["/chat/event/dispatch", "/internal/storage/credential"])
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
      ).status
    ).toBe(403)
})
