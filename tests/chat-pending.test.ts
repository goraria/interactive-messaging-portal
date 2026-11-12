import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vitest"
vi.mock("@/hooks/use-user", () => ({ useUser: () => ({ user: { id: "sender" } }) }))
vi.mock("@/services/client/messenger", () => ({
  changeMessengerMessage: vi.fn(), reactMessengerMessage: vi.fn(), reportMessengerMessage: vi.fn(),
}))
vi.mock("@gorth-io/primitive/dashboard/nav-user", () => ({ NavIdentity: () => null }))
import { Message } from "@/components/conversation/message"
import { messengerMessageSchema } from "@/schemas/client/messenger"

const message = messengerMessageSchema.parse({
  id: "8eac2f8a-6415-452f-aa2e-54286b14fcde", conversationId: "8eac2f8a-6415-452f-aa2e-54286b14fcdf",
  content: "Immediate preview", type: "text", user: { id: "sender", name: "Sender", email: null },
  editedAt: null, deletedAt: null, createdAt: "2026-11-06T00:00:00Z", updatedAt: "2026-11-06T00:00:00Z",
})
it("shows pending text without falsely confirming delivery or enabling server-side actions", () => {
  const html = renderToStaticMarkup(createElement(Message, {
    message, isOwnMessage: true, showHeader: false, showAvatar: false, pending: true,
  }))
  expect(html).toContain("Immediate preview")
  expect(html).toContain(">Sending<")
  for (const text of [">Sent<", ">Edit<", ">Delete<", "React to message"])
    expect(html).not.toContain(text)
})
