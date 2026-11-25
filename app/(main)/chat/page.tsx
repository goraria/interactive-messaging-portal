"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@gorth-com/primitive/custom/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@gorth-com/primitive/default/command";
import {
  MessagesSquare,
  Send,
  RefreshCw,
  TriangleAlert,
} from "@gorth-com/primitive/cores/lucide";
import { NavIdentity } from "@gorth-com/primitive/dashboard/nav-user";
import { Spinner } from "@gorth-com/primitive/pattern/spinner";
import { ConversationState } from "@/components/conversation/conversation-state";
import { useAuth } from "@/hooks/use-auth";
import { useUser } from "@/hooks/use-user";
import { visitor } from "@/utils/constant";
import {
  useConversationsQuery,
  useCreateConversationMutation,
  useUsersQuery,
} from "@/queries/chat";
import type { User } from "@/schemas/client/chat";
import { NewGroup } from "@/components/conversation/new-group";
import { useNetworkErrorToast } from "@/hooks/use-network-error-toast";

export default function ChatPage() {
  const router = useRouter();
  const auth = useAuth();
  const {
    user,
    loading: userLoading,
    error: userError,
    refresh: refreshUser,
  } = useUser();
  const displayName = user?.name ?? auth.account?.name ?? visitor.name;
  const [selectingUser, setSelectingUser] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const usersQuery = useUsersQuery(Boolean(user));
  const conversationsQuery = useConversationsQuery(Boolean(user));
  const networkError = useNetworkErrorToast(error);
  const usersNetworkError = useNetworkErrorToast(usersQuery.error);
  useNetworkErrorToast(userError);
  const [createConversation, createConversationState] =
    useCreateConversationMutation();
  const users = (usersQuery.data ?? []).filter(
    (candidate) => candidate.id !== user?.id,
  );

  async function openConversation(selectedUser: User) {
    if (!user || selectedUserId || createConversationState.isLoading) return;

    setSelectedUserId(selectedUser.id);
    setError(null);

    try {
      const existingConversation = (conversationsQuery.data ?? []).find(
        (conversation) =>
          conversation.type === "direct" &&
          conversation.members.some((member) => member.id === user.id) &&
          conversation.members.some((member) => member.id === selectedUser.id),
      );

      if (existingConversation) {
        router.push(`/chat/${existingConversation.id}`);
        return;
      }

      const conversation = await createConversation({
        type: "direct",
        title: selectedUser.name,
        participantIds: [selectedUser.id],
      }).unwrap();

      router.push(`/chat/${conversation.id}`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to start conversation",
      );
      setSelectedUserId(null);
    }
  }

  if (auth.loading || userLoading) {
    return (
      <main className="flex h-full items-center justify-center">
        <ConversationState loading />
      </main>
    );
  }

  if (userError) {
    return (
      <main className="flex h-full items-center justify-center p-6">
        <ConversationState
          icon={TriangleAlert}
          title="Unable to load your Chat profile"
          description="Your session has been kept. Please try again."
        >
          <Button
            variant="outline"
            onClick={() => void refreshUser().catch(() => undefined)}
          >
            <RefreshCw />
            Try again
          </Button>
        </ConversationState>
      </main>
    );
  }

  if (!selectingUser) {
    return (
      <main className="flex h-full items-center justify-center p-6 text-center">
        <div className="flex max-w-md flex-col items-center gap-4">
          <span className="bg-muted flex size-14 items-center justify-center rounded-md">
            <MessagesSquare className="size-6" />
          </span>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Hello, {displayName}</h1>
            <p className="text-muted-foreground text-sm leading-6">
              Select a conversation from the sidebar or start a new message.
            </p>
          </div>
          <Button onClick={() => setSelectingUser(true)}>
            <Send />
            Send message
          </Button>
          <NewGroup />
        </div>
      </main>
    );
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
                description={
                  usersNetworkError ? undefined : usersQuery.error.message
                }
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
                      <NavIdentity
                        user={{
                          name: candidate.name,
                          email: candidate.email,
                          avatar: candidate.image,
                        }}
                        trailing={
                          selectedUserId === candidate.id ? (
                            <Spinner variant="infinite" size={16} />
                          ) : null
                        }
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>

        {error && !networkError ? (
          <p className="text-destructive text-sm">{error}</p>
        ) : null}
        <Button variant="ghost" onClick={() => setSelectingUser(false)}>
          Cancel
        </Button>
      </div>
    </main>
  );
}
