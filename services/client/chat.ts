"use client"
import { z } from "@gorth-io/structure/cores/zod"
import {
  caller,
  useQuery,
  useMutation,
  createQueryService,
  createMutationService,
} from "@/utils/caller"
import {
  conversationDetailsSchema,
  conversationSchema,
  createConversationSchema,
  userSchema,
  type Conversation,
  type ConversationDetails,
  type User,
  type CreateConversationInput,
} from "@/schemas/client/chat"
/* eslint-disable react-hooks/rules-of-hooks -- these factories define query services, rather than rendering hooks. */
export const currentUserQueryKey = ["chat", "current-user"] as const
export const chatQueryKeys = {
  users: ["chat", "user-list"] as const,
  conversations: ["chat", "conversation-list"] as const,
  conversation: (id: string) => ["chat", "conversation", id] as const,
  messages: (id: string) => ["chat", "messages", id] as const,
}
interface ListInput {
  enabled: boolean
  limit: number
}
interface ConversationInput {
  conversationId: string
  enabled: boolean
}
interface UserInput {
  enabled: boolean
  userId?: string
}
const usersService = useQuery<User[], ListInput>({
  queryKey: ({ limit }: ListInput) => [...chatQueryKeys.users, { limit }],
  query: ({ limit }: ListInput) => ({
    url: "/chat/user",
    baseURL: null,
    params: { limit },
    schema: z.array(userSchema),
    cache: "no-store",
  }),
  queryOptions: ({ enabled }: ListInput) => ({
    enabled,
    retry: false,
    staleTime: 30000,
  }),
})
const conversationsService = useQuery<ConversationDetails[], ListInput>({
  queryKey: ({ limit }: ListInput) => [
    ...chatQueryKeys.conversations,
    { limit },
  ],
  query: ({ limit }: ListInput) => ({
    url: "/chat/conversation",
    baseURL: null,
    params: { limit },
    schema: z.array(conversationDetailsSchema),
    cache: "no-store",
  }),
  queryOptions: ({ enabled }: ListInput) => ({
    enabled,
    retry: false,
    staleTime: 15000,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  }),
})
const conversationService = useQuery<ConversationDetails, ConversationInput>({
  queryKey: ({ conversationId }: ConversationInput) =>
    chatQueryKeys.conversation(conversationId),
  query: ({ conversationId }: ConversationInput) => ({
    url: "/chat/conversation/" + encodeURIComponent(conversationId),
    baseURL: null,
    schema: conversationDetailsSchema,
    cache: "no-store",
  }),
  queryOptions: ({ enabled, conversationId }: ConversationInput) => ({
    enabled: enabled && Boolean(conversationId),
    retry: false,
    staleTime: 15000,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  }),
})
const currentUserService = useQuery<User, UserInput>({
  queryKey: ({ userId }: UserInput) => [...currentUserQueryKey, userId],
  query: {
    url: "/chat/user/me",
    baseURL: null,
    schema: userSchema,
    cache: "no-store",
  },
  queryOptions: ({ enabled, userId }: UserInput) => ({
    enabled: enabled && Boolean(userId),
    retry: false,
    staleTime: 5 * 60 * 1000,
  }),
})
const createConversationService = useMutation<
  Conversation,
  CreateConversationInput
>({
  query: (input: CreateConversationInput) => ({
    url: "/chat/conversation",
    baseURL: null,
    method: "POST",
    body: createConversationSchema.parse(input),
    schema: conversationSchema,
  }),
  invalidates: [chatQueryKeys.conversations],
})
const useUsers = createQueryService(usersService),
  useConversations = createQueryService(conversationsService),
  useConversation = createQueryService(conversationService),
  useCurrentUser = createQueryService(currentUserService),
  useCreateConversation = createMutationService(createConversationService)
export function useUsersQuery(enabled = true, limit = 50) {
  return useUsers({ enabled, limit })
}
export function useConversationsQuery(enabled = true, limit = 50) {
  return useConversations({ enabled, limit })
}
export function useConversationQuery(conversationId: string, enabled = true) {
  return useConversation({ conversationId, enabled })
}
export function useCurrentUserQuery(enabled: boolean, userId?: string) {
  return useCurrentUser({ enabled, userId })
}
export function useCreateConversationMutation() {
  return useCreateConversation()
}
export async function createConversation(input: CreateConversationInput) {
  return caller({
    url: "/chat/conversation",
    baseURL: null,
    method: "POST",
    body: createConversationSchema.parse(input),
    schema: conversationSchema,
  })
}
