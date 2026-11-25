import "server-only";
import { QueueClient } from "@vercel/queue";
import { vercelDeployment } from "@/utils/environment";

const topic = "chat-outbox";
let queue: QueueClient | undefined;
function getQueue() {
  return (queue ??= new QueueClient({ telemetry: { isEnabled: false } }));
}
export async function rawProcessBackgroundJob(message: unknown) {
  if (
    !message ||
    typeof message !== "object" ||
    (message as { kind?: unknown }).kind !== "drain"
  )
    throw new Error("Invalid background job");
  const { rawDispatchChatEvents: dispatchChatEvents } = await import("@/models/chat-delivery");
  for (let batch = 0; batch < 10; batch++) {
    const result = await dispatchChatEvents();
    if ("failed" in result && result.failed)
      throw new Error("Background delivery deferred");
    if (!result.claimed) return;
  }
  if (vercelDeployment) await rawEnqueueBackgroundJob();
}
export async function rawEnqueueBackgroundJob() {
  if (!vercelDeployment) {
    const { rawDrainLocalBackground: drainLocalBackground } =
      await import("@/services/background-local");
    return drainLocalBackground();
  }
  await getQueue().send(topic, { kind: "drain" });
}
export function rawBackgroundCallback(request: Request) {
  return getQueue().handleCallback(rawProcessBackgroundJob)(request);
}
