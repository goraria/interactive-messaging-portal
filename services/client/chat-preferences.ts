"use client"
import { caller } from "@/utils/caller"
export interface ChatPreference {
  notificationType: string
  channel: string
  enabled: boolean
  mutedUntil: string | null
}
export async function chatNotificationPreferences() {
  return caller<ChatPreference[]>({
    url: "/notification/preference",
    baseURL: null,
    cache: "no-store",
  })
}
export async function setChatNotificationPreference(
  channel: string,
  enabled: boolean
) {
  for (const type of ["*", "chat.message"])
    await caller({
      url: "/notification/preference",
      baseURL: null,
      method: "PUT",
      body: { type, channel, enabled, mutedUntil: null, metadata: {} },
    })
}
