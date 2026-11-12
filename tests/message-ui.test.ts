import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
vi.mock("@/hooks/use-user", () => ({
  useUser: () => ({ user: { id: "user" } }),
}))
vi.mock("@/services/client/messenger", () => ({
  changeMessengerMessage: vi.fn(),
  reactMessengerMessage: vi.fn(),
  reportMessengerMessage: vi.fn(),
}))
import { Message } from "@/components/conversation/message"
import type { ChatMessage } from "@/hooks/use-conversation"
const message: ChatMessage = {
  id: "message",
  conversationId: "room",
  user: { id: "user", name: "Gorth User", email: null },
  content: "A short message",
  type: "text",
  createdAt: "2026-11-11T12:00:00Z",
  updatedAt: "2026-11-11T12:00:00Z",
  deletedAt: null,
  editedAt: null,
  version: 1,
  syncVersion: "1",
  metadata: {},
  attachments: [],
  reactions: [],
  receipts: [],
}
it.each([true, false])(
  "renders the real Message/Bubble composition with correct alignment (%s)",
  (isOwnMessage) => {
    const html = renderToStaticMarkup(
      createElement(Message, {
        message,
        isOwnMessage,
        showAvatar: true,
        showHeader: true,
      })
    )
    for (const slot of [
      "message",
      "message-avatar",
      "avatar",
      "message-content",
      "bubble-group",
      "bubble",
      "bubble-content",
      "message-footer",
    ])
      expect(html).toContain(`data-slot="${slot}"`)
    expect(html).toContain(`data-align="${isOwnMessage ? "end" : "start"}"`)
    expect(html).toContain("size-9")
    expect(html).toContain("min-h-9")
    expect(html).toContain("min-w-9")
    expect(html).toContain("rounded-md")
    expect(html).toContain("A short message")
    expect(html).not.toContain('data-slot="nav-identity"')
  }
)
it("hides metadata inside a group and shows only partner time at its end", () => {
  const render = (showFooter: boolean) => renderToStaticMarkup(createElement(Message, {
    message, isOwnMessage: false, showAvatar: false, showHeader: false, showFooter,
  }))
  expect(render(false)).not.toContain("<time")
  const html = render(true)
  expect(html.match(/<time/g)).toHaveLength(1)
  expect(html).toContain("self-start justify-start")
  expect(html).not.toMatch(/>Read<|>Delivered<|>Sent</)
})
it("keeps error/resend/time centered in a fixed height sender footer", () => {
  const html = renderToStaticMarkup(createElement(Message, {
    message, isOwnMessage: true, showAvatar: true, showHeader: false,
    pending: true, failed: true, onRetry: vi.fn(),
  }))
  expect(html).toContain(">Error<")
  expect(html).toContain('aria-label="Resend message"')
  expect(html).toContain("size-5")
  expect(html).toContain("size-4")
  expect(html).toContain("h-5 items-center")
  expect(html).toContain("leading-5")
  expect(html).toContain("self-end justify-end")
  expect(html.indexOf(">Error<")).toBeLessThan(html.indexOf("<time"))
})
it("removes Read and its dot from older blocks while keeping their timestamp", () => {
  const readMessage = { ...message, receipts: [{ userId: "partner", status: "read" }] }
  const render = (showDeliveryStatus: boolean) => renderToStaticMarkup(createElement(Message, {
    message: readMessage, isOwnMessage: true, showAvatar: true, showHeader: true, showDeliveryStatus,
  }))
  expect(render(true)).toContain(">Read<")
  const older = render(false)
  expect(older).not.toContain(">Read<")
  expect(older).not.toContain("lucide-dot")
  expect(older).toContain("<time")
})
it("keeps tombstones and attachments inside the Message/Bubble structure", () => {
  const deleted = renderToStaticMarkup(
    createElement(Message, {
      message: { ...message, deletedAt: message.createdAt },
      isOwnMessage: true,
      showAvatar: true,
      showHeader: false,
    })
  )
  expect(deleted).toContain("Message deleted")
  expect(deleted).not.toContain("A short message")
  const withFile = renderToStaticMarkup(
    createElement(Message, {
      message: {
        ...message,
        attachments: [
          {
            id: "file",
            fileName: "photo.png",
            fileUrl: "/chat/attachment/file",
            mimeType: "image/png",
            sizeBytes: "1024",
          },
        ],
      },
      isOwnMessage: false,
      showAvatar: true,
      showHeader: true,
    })
  )
  expect(withFile.match(/data-slot="bubble"/g)).toHaveLength(2)
  expect(withFile).toContain("/chat/attachment/file")
})
it("gates call history, limits signaling to an active call, and keeps the shared scroll button", () => {
  const read = (path: string) =>
    readFileSync(new URL("../" + path, import.meta.url), "utf8")
  expect(read("components/conversation/call-controls.tsx")).toContain(
    "if (!enabled || !history) return"
  )
  expect(read("components/conversation/call-controls.tsx")).toContain(
    "if (!active) return"
  )
  expect(read("components/conversation/incoming-call.tsx")).not.toContain(
    "setInterval"
  )
  const broadcast = read("components/conversation/broadcast.tsx")
  expect(broadcast).toContain(
    'from "@gorth-io/primitive/custom/message-scroller"'
  )
  expect(broadcast).toContain('aria-label="Scroll to latest messages"')
})
