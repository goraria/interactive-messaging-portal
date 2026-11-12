"use client"
import { caller } from "@/utils/caller"
import {
  messengerPageSchema,
  messengerMessageSchema,
  messengerEventsSchema,
  callSchema,
} from "@/schemas/client/messenger"
import { z } from "@gorth-io/structure/cores/zod"
const conversation = (id: string) =>
  `/chat/conversation/${encodeURIComponent(id)}`
export async function messengerRealtimeConnection(id: string) {
  return caller({
    url: conversation(id) + "/realtime/token",
    baseURL: null,
    schema: z.object({ url: z.string(), transport: z.literal("websocket") }),
    cache: "no-store",
  })
}
export async function messengerPage(id: string, before?: string, q = "") {
  return caller({
    url: conversation(id) + "/message",
    baseURL: null,
    params: { limit: 50, before, q },
    schema: messengerPageSchema,
    unwrapData: false,
    cache: "no-store",
  })
}
export async function messengerEvents(id: string, after: string) {
  return caller({
    url: conversation(id) + "/event",
    baseURL: null,
    params: { after },
    schema: messengerEventsSchema,
    cache: "no-store",
  })
}
export async function messengerMessage(id: string) {
  return caller({
    url: "/chat/message/" + encodeURIComponent(id),
    baseURL: null,
    schema: messengerMessageSchema,
    cache: "no-store",
  })
}
export async function sendMessengerMessage(
  id: string,
  input: { content: string; clientMessageId: string; assetIds: string[] }
) {
  return caller({
    url: conversation(id) + "/message",
    baseURL: null,
    method: "POST",
    body: input,
    schema: messengerMessageSchema,
  })
}
export async function changeMessengerMessage(
  id: string,
  input: { content: string; version: number } | null
) {
  return caller({
    url: "/chat/message/" + encodeURIComponent(id),
    baseURL: null,
    method: input ? "PATCH" : "DELETE",
    body: input ?? undefined,
    schema: messengerMessageSchema,
  })
}
export async function reactMessengerMessage(
  id: string,
  emoji: string,
  remove = false
) {
  return caller({
    url: "/chat/message/" + encodeURIComponent(id) + "/reaction",
    baseURL: null,
    method: remove ? "DELETE" : "POST",
    body: { emoji },
    schema: messengerMessageSchema,
  })
}
export async function readMessengerMessage(id: string) {
  return caller({
    url: "/chat/message/" + encodeURIComponent(id) + "/receipt",
    baseURL: null,
    method: "POST",
    body: { status: "read" },
  })
}
export async function reportMessengerMessage(id: string, reason: string) {
  return caller({
    url: "/chat/message/" + encodeURIComponent(id) + "/report",
    baseURL: null,
    method: "POST",
    body: { reason },
  })
}
export async function messengerMutation(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown
) {
  return caller({ url: path, baseURL: null, method, body })
}
export async function messengerMembers(id: string) {
  return caller({
    url: conversation(id) + "/member",
    baseURL: null,
    schema: z.array(
      z.object({
        userId: z.string(),
        name: z.string(),
        role: z.enum(["owner", "admin", "member"]),
        leftAt: z.string().nullable(),
        joinedAt: z.string(),
      })
    ),
  })
}
export async function messengerIndexedSearch(id: string, query: string) {
  return caller({
    url: conversation(id) + "/search",
    baseURL: null,
    params: { q: query, limit: 50 },
    schema: z.array(messengerMessageSchema),
  })
}
export async function messengerDeliveryStatus(id: string) {
  return caller<
    {
      id: string
      type: string
      destination: string
      attempts: number
      deliveredAt: string | null
      lastError: string | null
    }[]
  >({ url: conversation(id) + "/delivery", baseURL: null })
}
export async function messengerCalls(id: string) {
  return caller({
    url: conversation(id) + "/call",
    baseURL: null,
    schema: z.array(callSchema),
    cache: "no-store",
  })
}
export async function incomingMessengerCalls() {
  return caller({
    url: "/chat/call/incoming",
    baseURL: null,
    schema: z.array(callSchema),
    cache: "no-store",
  })
}
export async function messengerIce() {
  return caller<{ iceServers: RTCIceServer[] }>({
    url: "/chat/call/ice",
    baseURL: null,
  })
}
export async function startMessengerCall(
  id: string,
  kind: "audio" | "video",
  clientId: string
) {
  return caller<{ id: string }>({
    url: conversation(id) + "/call",
    baseURL: null,
    method: "POST",
    body: { kind, clientId },
  })
}
export async function messengerSignal(
  id: string,
  kind: "offer" | "answer" | "ice" | "accept" | "reject" | "end",
  payload = ""
) {
  return caller({
    url: `/chat/call/${id}/signal`,
    baseURL: null,
    method: "POST",
    body: { kind, payload, clientId: crypto.randomUUID() },
  })
}
export async function messengerSignals(id: string, after: string) {
  return caller<{
    data: {
      sequence: string
      kind: string
      payload: string
      senderId: string
    }[]
    state: string
  }>({
    url: `/chat/call/${id}/signal`,
    baseURL: null,
    params: { after },
    unwrapData: false,
    cache: "no-store",
  })
}
export async function messengerBuckets() {
  return caller<{ id: string; name: string }[]>({
    url: "/media/bucket",
    baseURL: null,
  })
}
export async function uploadMessengerFile(
  id: string,
  bucket: string,
  file: File,
  signal: AbortSignal,
  onProgress: (percent: number) => void
) {
  const result = await caller<{
    asset: { id: string }
    upload: { id: string; url: string; headers: Record<string, string> }
  }>({
    url: conversation(id) + "/upload",
    baseURL: null,
    method: "POST",
    body: {
      bucket,
      filename: file.name,
      contentType: file.type.split(";")[0],
      size: file.size,
    },
  })
  try {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const abort = () => xhr.abort()
      signal.addEventListener("abort", abort, { once: true })
      const cleanup = () => signal.removeEventListener("abort", abort)
      xhr.open("PUT", result.upload.url)
      xhr.timeout = 120000
      for (const [key, value] of Object.entries(result.upload.headers))
        xhr.setRequestHeader(key, value)
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable)
          onProgress(Math.round((event.loaded / event.total) * 100))
      }
      xhr.onload = () => {
        cleanup()
        if (xhr.status >= 200 && xhr.status < 300) resolve()
        else reject(new Error("Upload failed"))
      }
      xhr.onerror = () => {
        cleanup()
        reject(new Error("Upload failed"))
      }
      xhr.ontimeout = () => {
        cleanup()
        reject(new Error("Upload timed out"))
      }
      xhr.onabort = () => {
        cleanup()
        reject(new Error("Upload cancelled"))
      }
      if (signal.aborted) {
        cleanup()
        reject(new Error("Upload cancelled"))
        return
      }
      xhr.send(file)
    })
    if (signal.aborted) throw new Error("Upload cancelled")
    await messengerMutation(
      conversation(id) + `/upload/${result.upload.id}/complete`,
      "POST",
      {}
    )
    return { assetId: result.asset.id, name: file.name }
  } catch (error) {
    await messengerMutation(
      conversation(id) + `/upload/${result.upload.id}/abort`,
      "POST",
      {}
    ).catch(() => undefined)
    throw error
  }
}
