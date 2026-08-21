"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@gorth/primitive/custom/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@gorth/primitive/default/command"
import { MessagesSquare, Send } from "@gorth/primitive/cores/lucide"
import { useQueryClient } from "@gorth/primitive/cores/tanstack/query"
import { ConversationItem } from "@/components/conversation/message/conversation-item"
import { ConversationState } from "@/components/conversation/conversation-state"
import { useAccount } from "@/hooks/use-user"
import {
  addConversationMember,
  chatQueryKeys,
  createConversation,
  useConversationsQuery,
  useUsersQuery,
} from "@/services/chat"
import type { User } from "@/schemas/chat"

export default function ChatPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user, sidebarUser, auth } = useAccount()
  const [selectingUser, setSelectingUser] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const usersQuery = useUsersQuery(Boolean(user))
  const conversationsQuery = useConversationsQuery(Boolean(user))
  const users = (usersQuery.data ?? []).filter(
    (candidate) => candidate.id !== user?.id
  )

  async function openConversation(selectedUser: User) {
    if (!user || selectedUserId) return

    setSelectedUserId(selectedUser.id)
    setError(null)

    try {
      const existingConversation = (conversationsQuery.data ?? []).find(
        (conversation) =>
          conversation.type === "direct" &&
          conversation.members.some((member) => member.id === user.id) &&
          conversation.members.some((member) => member.id === selectedUser.id)
      )

      if (existingConversation) {
        router.push(`/chat/${existingConversation.id}`)
        return
      }

      const conversation = await createConversation({
        type: "direct",
        title: selectedUser.name,
        createdById: user.id,
      })

      await Promise.all([
        addConversationMember(conversation.id, {
          userId: user.id,
          role: "owner",
        }),
        addConversationMember(conversation.id, {
          userId: selectedUser.id,
          role: "member",
        }),
      ])
      await queryClient.invalidateQueries({
        queryKey: chatQueryKeys.conversations,
      })
      router.push(`/chat/${conversation.id}`)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to start conversation"
      )
      setSelectedUserId(null)
    }
  }

  if (auth.loading) {
    return (
      <main className="flex h-full items-center justify-center">
        <ConversationState loading />
      </main>
    )
  }

  if (!selectingUser) {
    return (
      <main className="flex h-full items-center justify-center p-6 text-center">
        <div className="flex max-w-md flex-col items-center gap-4">
          <span className="bg-muted flex size-14 items-center justify-center rounded-md">
            <MessagesSquare className="size-6" />
          </span>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">
              Hello, {sidebarUser.name}
            </h1>
            <p className="text-muted-foreground text-sm leading-6">
              Select a conversation from the sidebar or start a new message.
            </p>
          </div>
          <Button onClick={() => setSelectingUser(true)}>
            <Send />
            Send message
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-xl space-y-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">New message</h1>
          <p className="text-muted-foreground text-sm">
            Choose someone to start a conversation with.
          </p>
        </div>

        <Command className="bg-card h-auto border">
          <CommandInput placeholder="Search people..." />
          <CommandList className="max-h-80">
            {usersQuery.isPending ? (
              <ConversationState loading />
            ) : usersQuery.error ? (
              <ConversationState
                icon={MessagesSquare}
                title="Unable to load people"
                description={usersQuery.error.message}
              />
            ) : (
              <>
                <CommandEmpty>
                  <ConversationState
                    icon={MessagesSquare}
                    title="No people found"
                    description="Try another search."
                  />
                </CommandEmpty>
                <CommandGroup heading="People">
                  {users.map((candidate) => (
                    <CommandItem
                      key={candidate.id}
                      value={`${candidate.name} ${candidate.email}`}
                      disabled={Boolean(selectedUserId)}
                      onSelect={() => void openConversation(candidate)}
                      className="p-3 [&>svg:last-child]:hidden"
                    >
                      <ConversationItem
                        name={candidate.name}
                        description={candidate.email}
                        avatar={candidate.image}
                        pending={selectedUserId === candidate.id}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <Button variant="ghost" onClick={() => setSelectingUser(false)}>
          Cancel
        </Button>
      </div>
    </main>
  )
}
