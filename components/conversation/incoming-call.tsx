"use client"
import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@gorth-io/primitive/custom/button"
import { messengerSignal } from "@/services/client/messenger"
import type { MessengerCall } from "@/schemas/client/messenger"
import { subscribeIncomingCalls } from "@/lib/realtime/call-client"
import { useUser } from "@/hooks/use-user"
export function IncomingCall() {
  const [snapshot, setSnapshot] = useState<{
    userId: string
    call: MessengerCall | null
  } | null>(null)
  const { user } = useUser()
  const pathname = usePathname(),
    router = useRouter()
  useEffect(() => {
    if (!user?.id) return
    return subscribeIncomingCalls(user.id, (calls) =>
      setSnapshot({ userId: user.id, call: calls[0] ?? null })
    )
  }, [user?.id])
  const call = snapshot?.userId === user?.id ? snapshot?.call : null
  if (!call || pathname === "/chat/" + call.conversationId) return null
  return (
    <aside
      role="alert"
      className="fixed bottom-4 right-4 z-50 space-y-2 rounded-lg border bg-card p-4 shadow-lg"
    >
      <p>Incoming {call.kind} call</p>
      <Button onClick={() => router.push("/chat/" + call.conversationId)}>
        Open conversation
      </Button>
      <Button
        variant="outline"
        onClick={() => {
          void messengerSignal(call.id, "reject").catch(() => undefined)
          setSnapshot(null)
        }}
      >
        Decline
      </Button>
    </aside>
  )
}
