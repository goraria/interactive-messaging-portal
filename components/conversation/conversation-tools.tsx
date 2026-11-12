"use client"
import { useEffect, useState } from "react"
import { useNetworkErrorToast } from "@/hooks/use-network-error-toast"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@gorth-io/primitive/cores/tanstack/query"
import { Button } from "@gorth-io/primitive/custom/button"
import { Input } from "@gorth-io/primitive/default/input"
import { useUser } from "@/hooks/use-user"
import {
  chatQueryKeys,
  useConversationQuery,
  useUsersQuery,
} from "@/services/client/chat"
import {
  messengerMembers,
  messengerMutation,
  messengerPage,
  messengerIndexedSearch,
  messengerDeliveryStatus,
} from "@/services/client/messenger"
import type { MessengerMessage } from "@/schemas/client/messenger"
import { NavIdentity } from "@gorth-io/primitive/dashboard/nav-user"
import { Ellipsis, UserRound, Ban, ShieldCheck, UserMinus } from "@gorth-io/primitive/cores/lucide"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@gorth-io/primitive/custom/dropdown"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@gorth-io/primitive/default/dialog"
import { ConversationState } from "@/components/conversation/conversation-state"

export function ConversationTools({
  conversationId,
  view = "settings",
}: {
  conversationId: string
  view?: "members" | "search" | "settings"
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useUser()
  const conversation = useConversationQuery(
    conversationId,
    Boolean(conversationId && user)
  ).data
  const users = useUsersQuery(Boolean(conversationId && user && view === "members")).data ?? []
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [members, setMembers] = useState<
    Awaited<ReturnType<typeof messengerMembers>>
  >([])
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<MessengerMessage[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [target, setTarget] = useState("")
  const [error, setError] = useState<string | null>(null)
  const networkError = useNetworkErrorToast(error)
  const [busy, setBusy] = useState(false)
  const [profileId, setProfileId] = useState<string | null>(null)
  const profile = members.find((member) => member.userId === profileId)
  const [deliveries, setDeliveries] = useState<
    Awaited<ReturnType<typeof messengerDeliveryStatus>>
  >([])
  useEffect(() => {
    let cancelled = false
    if (conversationId)
      void messengerMembers(conversationId)
        .then((rows) => {
          if (!cancelled) setMembers(rows)
        })
        .catch((cause) => {
          if (!cancelled) {
            setMembers([])
            setError(cause instanceof Error ? cause.message : "Unable to load members")
          }
        })
        .finally(() => { if (!cancelled) setLoadingMembers(false) })
    return () => {
      cancelled = true
    }
  }, [conversationId, conversation])
  const own = members.find(
    (member) => member.userId === user?.id && !member.leftAt
  )
  const manager = own?.role === "owner" || own?.role === "admin"
  const base = "/chat/conversation/" + conversationId
  async function mutate(
    path: string,
    method: "POST" | "PATCH" | "DELETE",
    body?: unknown
  ) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await messengerMutation(path, method, body)
      if (method === "DELETE" && path === base + "/member/" + user?.id) {
        router.push("/chat")
        return
      }
      await queryClient.invalidateQueries({
        queryKey: chatQueryKeys.conversations,
      })
      await queryClient.invalidateQueries({
        queryKey: chatQueryKeys.conversation(conversationId),
      })
      setMembers(await messengerMembers(conversationId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operation failed")
    } finally {
      setBusy(false)
    }
  }
  async function search(before?: string) {
    setBusy(true)
    setError(null)
    try {
      const page = await messengerPage(conversationId, before, query)
      setResults((current) => (before ? [...page.data, ...current] : page.data))
      setCursor(page.pagination.nextCursor)
    } catch {
      setError("Unable to search messages")
    } finally {
      setBusy(false)
    }
  }
  if (!conversationId) return null
  return (
    <div className="space-y-5 p-4">
      <div hidden={view !== "search"} className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Messages are processed by GorCer servers. End-to-end encryption is not
        enabled.
      </p>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault()
          void search()
        }}
      >
        <Input
          aria-label="Search messages"
          placeholder="Search conversation…"
          value={query}
          maxLength={200}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button variant="outline" disabled={busy || !query.trim()}>
          Search
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy || !query.trim()}
          onClick={() => {
            setBusy(true)
            setError(null)
            void messengerIndexedSearch(conversationId, query)
              .then((rows) => {
                setResults(rows)
                setCursor(null)
              })
              .catch(() =>
                setError("Search index unavailable; use conversation search.")
              )
              .finally(() => setBusy(false))
          }}
        >
          Indexed search
        </Button>
      </form>
      {results.map((message) => (
        <article
          key={message.id}
          className="space-y-1 rounded-md border p-2 text-sm"
        >
          <p className="font-medium">{message.user.name}</p>
          <p className="whitespace-pre-wrap break-words">
            {message.deletedAt ? "Deleted message" : message.content}
          </p>
          <time className="text-xs text-muted-foreground">
            {new Date(message.createdAt).toLocaleString()}
          </time>
        </article>
      ))}
      {cursor ? (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void search(cursor)}
        >
          Older results
        </Button>
      ) : null}
      </div>
      {error && !networkError ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div hidden={view !== "settings"}>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() =>
          void mutate(base + "/preference", "PATCH", {
            mutedUntil: conversation?.mutedUntil
              ? null
              : new Date(Date.now() + 86400000).toISOString(),
          })
        }
      >
        {conversation?.mutedUntil ? "Unmute" : "Mute for 24 hours"}
      </Button>
      </div>
      <section hidden={view !== "members"} className="space-y-2">
        {loadingMembers ? <ConversationState loading /> : !error && !members.some((member) => !member.leftAt) ? <ConversationState title="No members" /> : null}
        {members
          .filter((member) => !member.leftAt)
          .map((member) => (
            <div
              key={member.userId}
              className="flex flex-wrap items-center gap-2 text-sm"
            >
              <NavIdentity
                user={{ name: member.name, avatar: users.find((candidate) => candidate.id === member.userId)?.image }}
                description={member.role}
                trailing={
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={"Options for " + member.name} />}>
                      <Ellipsis className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setProfileId(member.userId)}><UserRound />Profile</DropdownMenuItem>
                      {conversation?.type !== "direct" && own?.role === "owner" && member.userId !== user?.id ? (
                        (["member", "admin", "owner"] as const).map((role) => (
                          <DropdownMenuItem key={role} disabled={busy || role === member.role} onClick={() => {
                            if (role === "owner" && !window.confirm("Transfer ownership to this member?")) return
                            void mutate(base + "/member/" + member.userId, "PATCH", { role })
                          }}> {role === "owner" ? "Transfer ownership" : "Set role: " + role}</DropdownMenuItem>
                        ))
                      ) : null}
                      {member.userId !== user?.id ? <>
                        <DropdownMenuItem variant="destructive" disabled={busy} onClick={() => {
                          if (window.confirm("Block communication with this person?")) void mutate("/chat/block/" + member.userId, "POST")
                        }}><Ban />Block</DropdownMenuItem>
                        <DropdownMenuItem disabled={busy} onClick={() => void mutate("/chat/block/" + member.userId, "DELETE")}><ShieldCheck />Unblock</DropdownMenuItem>
                        {manager && conversation?.type !== "direct" ? (
                          <DropdownMenuItem variant="destructive" disabled={busy} onClick={() => {
                            if (window.confirm("Remove this member?")) void mutate(base + "/member/" + member.userId, "DELETE")
                          }}><UserMinus />Remove member</DropdownMenuItem>
                        ) : null}
                      </> : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                }
              />
            </div>
          ))}
      </section>
      {view === "members" && conversation?.type !== "direct" && manager ? (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (target)
              void mutate(base + "/member", "POST", {
                userId: target,
                role: "member",
              })
          }}
        >
          <select
            aria-label="Member to add"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          >
            <option value="">Select a member</option>
            {users
              .filter(
                (candidate) =>
                  !members.some(
                    (member) => member.userId === candidate.id && !member.leftAt
                  )
              )
              .map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
          </select>
          <Button variant="outline" disabled={busy || !target}>
            Add member
          </Button>
        </form>
      ) : null}
      <div hidden={view !== "settings"} className="space-y-3">
      {conversation?.type !== "direct" && own?.role !== "owner" ? (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            if (window.confirm("Leave this conversation?"))
              void mutate(base + "/member/" + user?.id, "DELETE")
          }}
        >
          Leave conversation
        </Button>
      ) : null}
      {manager ? (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            void mutate(base, "PATCH", { archived: !conversation?.archivedAt })
          }
        >
          {conversation?.archivedAt
            ? "Restore conversation"
            : "Archive conversation"}
        </Button>
      ) : null}
      {manager ? (
        <section className="space-y-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              void messengerDeliveryStatus(conversationId)
                .then(setDeliveries)
                .catch(() => setError("Delivery status unavailable"))
                .finally(() => setBusy(false))
            }}
          >
            Delivery status
          </Button>
          {deliveries
            .filter((row) => !row.deliveredAt)
            .map((row) => (
              <div
                key={row.id + row.destination}
                className="space-y-1 rounded-md border p-2 text-xs"
              >
                <p>
                  {row.type} · {row.destination} · {row.attempts} attempts
                </p>
                <p>{row.lastError ?? "Pending"}</p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void mutate(
                      base + "/delivery/" + row.id + "/retry",
                      "POST",
                      {}
                    )
                  }
                >
                  Retry
                </Button>
              </div>
            ))}
        </section>
      ) : null}
      </div>
      <Dialog open={Boolean(profile)} onOpenChange={(open) => { if (!open) setProfileId(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Member profile</DialogTitle>
            <DialogDescription>Membership details for this conversation.</DialogDescription>
          </DialogHeader>
          {profile ? <>
            <NavIdentity user={{ name: profile.name, avatar: users.find((candidate) => candidate.id === profile.userId)?.image }} description={profile.role} />
            <p className="text-sm text-muted-foreground">Joined {new Date(profile.joinedAt).toLocaleDateString()}</p>
          </> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
