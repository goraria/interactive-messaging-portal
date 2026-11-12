import "server-only"
import { randomUUID } from "node:crypto"
import { sql } from "drizzle-orm"
import { chatRows } from "@/services/helper"
import { getDatabase } from "@/database"
import { chatPlatformRequest } from "@/services/chat-platform"
import { publishConversationEvent } from "@/services/realtime"
import { appUrl } from "@/utils/environment"

interface Delivery extends Record<string, unknown> {
  event_id: string
  destination: string
  attempts: number
  id: string
  conversation_id: string
  actor_id: string
  entity_id: string
  type: string
  created_at: Date
  sequence: string
}
export async function dispatchChatEvents(onlyEventId?: string, destination?: "realtime") {
  const lease = randomUUID()
  const jobs = await chatRows<Delivery>(
    sql`WITH selected AS (SELECT d.event_id,d.destination FROM chat_delivery d JOIN chat_event e ON e.id=d.event_id WHERE d.delivered_at IS NULL AND d.attempts<20 AND d.available_at<=clock_timestamp() AND (d.lease_until IS NULL OR d.lease_until<=clock_timestamp()) ${onlyEventId ? sql`AND e.id=${onlyEventId}::uuid` : sql``} ${destination ? sql`AND d.destination=${destination}` : sql``} ORDER BY e.sequence,d.destination LIMIT 12 FOR UPDATE OF d SKIP LOCKED), leased AS (UPDATE chat_delivery d SET lease_token=${lease}::uuid,lease_until=clock_timestamp()+interval '180 seconds',attempts=d.attempts+1 FROM selected s WHERE d.event_id=s.event_id AND d.destination=s.destination RETURNING d.*) SELECT d.*,e.id,e.conversation_id,e.actor_id,e.entity_id,e.type,e.created_at,e.sequence::text FROM leased d JOIN chat_event e ON e.id=d.event_id`
  )
  let delivered = 0,
    failed = 0
  await Promise.all(
    jobs.map(async (job) => {
      try {
        if (job.destination === "realtime") {
          await publishConversationEvent(job.event_id, lease)
          delivered++
          return
        } else if (job.destination === "notification") {
          const recipients = await chatRows(
            sql`SELECT u.external_user_id,u.name,u.email FROM conversation_member m JOIN "user" u ON u.id=m.user_id JOIN message msg ON msg.id=${job.entity_id}::uuid WHERE m.conversation_id=${job.conversation_id}::uuid AND m.user_id<>${job.actor_id}::uuid AND m.left_at IS NULL AND (m.muted_until IS NULL OR m.muted_until<now()) AND msg.deleted_at IS NULL AND msg.created_at>=m.joined_at AND NOT EXISTS(SELECT 1 FROM chat_block b WHERE (b.user_id=m.user_id AND b.target_id=${job.actor_id}::uuid) OR (b.target_id=m.user_id AND b.user_id=${job.actor_id}::uuid))`
          )
          const sendRecipient = async (recipient: Record<string, unknown>) =>
            await chatPlatformRequest(
              "notification",
              "/notification/event",
              "POST",
              {
                recipientExternalUserId: recipient.external_user_id,
                recipientProfile: {
                  name: recipient.name,
                  email: recipient.email,
                },
                deduplicationKey: job.id + ":" + recipient.external_user_id,
                type: "chat.message",
                title: "New message",
                body: "Open GorCer to read your message.",
                actionUrl: new URL("/chat/" + job.conversation_id, appUrl).href,
                resourceType: "conversation",
                resourceId: job.conversation_id,
                channels: ["email", "push", "web_push"],
                payload: {},
              }
            )
          let nextRecipient = 0,
            deliveryFailed = false
          await Promise.all(
            Array.from({ length: Math.min(8, recipients.length) }, async () => {
              while (!deliveryFailed && nextRecipient < recipients.length) {
                const recipient = recipients[nextRecipient++]!
                try {
                  await sendRecipient(recipient)
                } catch {
                  deliveryFailed = true
                }
              }
            })
          )
          if (deliveryFailed)
            throw new Error("notification_delivery_unavailable")
        } else if (job.destination === "insight") {
          await chatPlatformRequest("insight", "/insight/chat/event", "POST", {
            idempotencyKey: job.id,
            name: job.type,
            resourceId: job.entity_id,
            conversationId: job.conversation_id,
            occurredAt: job.created_at,
          })
        } else if (job.destination === "discovery") {
          // Retried jobs always publish the latest version, not stale event content.
          const [snapshot] = await chatRows(
            sql`SELECT m.*,e.id AS event_id,e.sequence::text FROM message m JOIN LATERAL(SELECT id,sequence FROM chat_event WHERE entity_id=m.id AND type IN ('message.created','message.updated','message.deleted') ORDER BY sequence DESC LIMIT 1)e ON true WHERE m.id=${job.entity_id}::uuid`
          )
          if (snapshot)
            await chatPlatformRequest("discovery", "/discovery/sync", "POST", [
              {
                id: snapshot.event_id,
                resourceType: "message",
                resourceId: job.entity_id,
                revision: Number(snapshot.sequence),
                operation: snapshot.deleted_at ? "delete" : "upsert",
                ...(!snapshot.deleted_at
                  ? {
                      document: {
                        title: "Message",
                        content: snapshot.content,
                        visibility: "private",
                        facets: { conversationId: [job.conversation_id] },
                        sourceCreatedAt: new Date(
                          String(snapshot.created_at)
                        ).toISOString(),
                        sourceUpdatedAt: new Date(
                          String(snapshot.updated_at)
                        ).toISOString(),
                      },
                    }
                  : {}),
              },
            ])
        }
        await getDatabase().execute(
          sql`UPDATE chat_delivery SET delivered_at=clock_timestamp(),lease_token=NULL,lease_until=NULL,last_error=NULL WHERE event_id=${job.event_id}::uuid AND destination=${job.destination} AND lease_token=${lease}::uuid`
        )
        delivered++
      } catch {
        await getDatabase().execute(
          sql`UPDATE chat_delivery SET available_at=clock_timestamp()+${Math.min(3600, 2 ** Math.min(job.attempts, 12))}*interval '1 second',lease_token=NULL,lease_until=NULL,last_error='upstream_unavailable' WHERE event_id=${job.event_id}::uuid AND destination=${job.destination} AND lease_token=${lease}::uuid`
        )
        failed++
      }
    })
  )
  return { claimed: jobs.length, delivered, failed }
}
