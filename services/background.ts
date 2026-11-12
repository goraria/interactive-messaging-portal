import "server-only"
import { QueueClient, registerDevConsumer } from "@vercel/queue"
import { nodeEnv } from "@/utils/environment"

const topic = "chat-outbox"
const queue = new QueueClient({ telemetry: { isEnabled: false } })
export async function processBackgroundJob(message: unknown) {
  if (!message || typeof message !== "object" ||
      (message as { kind?: unknown }).kind !== "drain") throw new Error("Invalid background job")
  const { dispatchChatEvents } = await import("@/services/chat-delivery")
  for (let batch = 0; batch < 10; batch++) {
    const result = await dispatchChatEvents()
    if ("failed" in result && result.failed) throw new Error("Background delivery deferred")
    if (!result.claimed) return
  }
  await enqueueBackgroundJob()
}
let registered = false
export async function enqueueBackgroundJob() {
  if (nodeEnv === "development" && !registered) {
    registerDevConsumer({ client: queue, topic, consumerGroup: "chat-delivery", handler: processBackgroundJob })
    registered = true
  }
  await queue.send(topic, { kind: "drain" })
}
export const backgroundCallback = queue.handleCallback(processBackgroundJob)
