"use client"
import { useEffect, useState } from "react"
import { messengerPage } from "@/services/client/messenger"
import type { MessengerMessage } from "@/schemas/client/messenger"
import { Button } from "@gorth-io/primitive/custom/button"
import { ConversationState } from "@/components/conversation/conversation-state"
import { useNetworkErrorToast } from "@/hooks/use-network-error-toast"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@gorth-io/primitive/custom/tabs"

export function InfoAssets({ conversationId, kind, onKindChange }: { conversationId: string; kind: "media" | "files" | "links"; onKindChange: (kind: "media" | "files" | "links") => void }) {
  const [messages, setMessages] = useState<MessengerMessage[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const networkError = useNetworkErrorToast(error)
  useEffect(() => {
    let cancelled = false
    void messengerPage(conversationId).then((page) => {
      if (!cancelled) { setMessages(page.data); setCursor(page.pagination.nextCursor) }
    }).catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load content") })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [conversationId])
  const visible = messages.filter((message) => !message.deletedAt)
  const attachments = visible.flatMap((message) => message.attachments).filter((file) =>
    kind === "media" ? /^(image|video)\//.test(file.mimeType ?? "") : !/^(image|video)\//.test(file.mimeType ?? "")
  )
  const links = [...new Set(visible.flatMap((message) => message.content.match(/https?:\/\/[^\s<>"']+/g) ?? []))]
  return <Tabs className="p-4" value={kind} onValueChange={(value) => {
    if (value === "media" || value === "files" || value === "links") onKindChange(value)
  }}>
    <TabsList aria-label="Shared content">
      <TabsTrigger value="media">Media</TabsTrigger>
      <TabsTrigger value="files">Files</TabsTrigger>
      <TabsTrigger value="links">Links</TabsTrigger>
    </TabsList>
    <TabsContent value={kind} className="space-y-3">
    {loading && !messages.length ? <ConversationState loading /> : null}
    {error && !networkError ? <p role="alert">{error}</p> : null}
    {kind === "links" ? links.map((url) => <a className="block break-all text-sm underline" key={url} href={url} target="_blank" rel="noopener noreferrer">{url}</a>) : attachments.map((file) => <a className="block rounded-md border p-3 text-sm break-all" key={file.id} href={file.fileUrl} target="_blank" rel="noopener noreferrer">{file.fileName}</a>)}
    {!loading && !error && !(kind === "links" ? links.length : attachments.length) ? <ConversationState title="No items in the loaded messages" /> : null}
    {cursor ? <Button disabled={loading} variant="secondary" onClick={() => {
      setLoading(true); setError(null)
      void messengerPage(conversationId, cursor).then((page) => {
        setMessages((current) => [...page.data, ...current]); setCursor(page.pagination.nextCursor)
      }).catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load older content"))
        .finally(() => setLoading(false))
    }}>Load older messages</Button> : null}
    </TabsContent>
  </Tabs>
}
