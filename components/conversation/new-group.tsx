"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@gorth-io/primitive/custom/button"
import { Input } from "@gorth-io/primitive/default/input"
import { Checkbox } from "@gorth-io/primitive/default/checkbox"
import { createConversation, useUsersQuery } from "@/services/client/chat"
import { useUser } from "@/hooks/use-user"
import { useNetworkErrorToast } from "@/hooks/use-network-error-toast"
export function NewGroup() {
  const router = useRouter(),
    { user } = useUser()
  const [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false)
  const users = useUsersQuery(open).data ?? []
  const networkError = useNetworkErrorToast(error)
  if (!open)
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        New group
      </Button>
    )
  return (
    <form
      className="w-full space-y-3 rounded-lg border p-4 text-left"
      onSubmit={(event) => {
        event.preventDefault()
        setBusy(true)
        setError(null)
        void createConversation({
          title: name,
          type: "group",
          participantIds: selected,
        })
          .then((conversation) => router.push("/chat/" + conversation.id))
          .catch((cause) =>
            setError(
              cause instanceof Error ? cause.message : "Unable to create group"
            )
          )
          .finally(() => setBusy(false))
      }}
    >
      <Input
        aria-label="Group name"
        placeholder="Group name"
        maxLength={200}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <div className="max-h-60 space-y-2 overflow-auto">
        {users
          .filter((candidate) => candidate.id !== user?.id)
          .map((candidate) => (
            <label
              key={candidate.id}
              className="flex items-center gap-2 text-sm"
            >
              <Checkbox
                checked={selected.includes(candidate.id)}
                onCheckedChange={(checked) =>
                  setSelected((current) =>
                    checked
                      ? [...current, candidate.id]
                      : current.filter((id) => id !== candidate.id)
                  )
                }
              />
              {candidate.name}
            </label>
          ))}
      </div>
      {error && !networkError ? <p role="alert">{error}</p> : null}
      <Button disabled={busy || !name.trim() || !selected.length}>
        Create group
      </Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  )
}
