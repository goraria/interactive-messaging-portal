import { handle } from "@hono/vercel"
import { after } from "next/server"
import { api } from "@/app/api"
import { enqueueBackgroundJob } from "@/services/background"
import { dispatchChatEvents } from "@/services/chat-delivery"
import { withRealtimeMutations } from "@/lib/realtime/mutation"

const handleApi = handle(api)

/** Shared by catch-all and concrete routes so a message cannot bypass immediate enqueue. */
export async function handleBackgroundApi(request: Request) {
  const response = await withRealtimeMutations(() => handleApi(request))
  const pathname = new URL(request.url).pathname
  if (response.ok && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method) &&
      pathname !== "/auth" && !pathname.startsWith("/auth/")) {
    after(async () => {
      // Realtime must not wait for Queue scheduling or notification/index delivery.
      await Promise.all([
        dispatchChatEvents(undefined, "realtime").then(({ failed }) => {
          if (failed) console.error("[background] realtime_deferred; outbox retained for recovery")
        }).catch(() => {
          console.error("[background] realtime_deferred; outbox retained for recovery")
        }),
        enqueueBackgroundJob().catch(() => {
          console.error("[background] enqueue_failed; outbox retained for recovery")
        }),
      ])
    })
  }
  return response
}
