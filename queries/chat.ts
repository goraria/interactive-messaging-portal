"use client";
import { z } from "@gorth-com/structure/cores/zod";
import {
  caller,
  defineQuery,
  defineMutation,
  createQueryService,
  createMutationService,
} from "@/utils/caller";
import {
  conversationDetailsSchema,
  conversationSchema,
  createConversationSchema,
  userSchema,
  type Conversation,
  type ConversationDetails,
  type User,
  type CreateConversationInput,
} from "@/schemas/client/chat";
export const currentUserQueryKey = ["chat", "current-user"] as const;
export const chatQueryKeys = {
  users: ["chat", "user-list"] as const,
  conversations: ["chat", "conversation-list"] as const,
  conversation: (id: string) => ["chat", "conversation", id] as const,
  messages: (id: string) => ["chat", "messages", id] as const,
};
interface ListInput {
  enabled: boolean;
  limit: number;
}
interface ConversationInput {
  id: string;
  enabled: boolean;
}
interface UserInput {
  enabled: boolean;
  userId?: string;
}
const usersService = defineQuery<User[], ListInput>({
  queryKey: ({ limit }: ListInput) => [...chatQueryKeys.users, { limit }],
  query: ({ limit }: ListInput) => ({
    url: "/internal/user",
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
});
const conversationsService = defineQuery<ConversationDetails[], ListInput>({
  queryKey: ({ limit }: ListInput) => [
    ...chatQueryKeys.conversations,
    { limit },
  ],
  query: ({ limit }: ListInput) => ({
    url: "/internal/conversation",
    baseURL: null,
    params: { limit },
    schema: z.array(conversationDetailsSchema),
    cache: "no-store",
  }),
  queryOptions: ({ enabled }: ListInput) => ({
    enabled,
    retry: false,
    staleTime: 15000,
    refetchInterval: false,
    refetchOnWindowFocus: true,
  }),
});
const conversationService = defineQuery<ConversationDetails, ConversationInput>(
  {
    queryKey: ({ id }: ConversationInput) => chatQueryKeys.conversation(id),
    query: ({ id }: ConversationInput) => ({
      url: "/internal/conversation/" + encodeURIComponent(id),
      baseURL: null,
      schema: conversationDetailsSchema,
      cache: "no-store",
    }),
    queryOptions: ({ enabled, id }: ConversationInput) => ({
      enabled: enabled && Boolean(id),
      retry: false,
      staleTime: 15000,
      refetchInterval: false,
      refetchOnWindowFocus: true,
    }),
  },
);
const currentUserService = defineQuery<User, UserInput>({
  queryKey: ({ userId }: UserInput) => [...currentUserQueryKey, userId],
  query: {
    url: "/internal/user/me",
    baseURL: null,
    schema: userSchema,
    cache: "no-store",
  },
  queryOptions: ({ enabled, userId }: UserInput) => ({
    enabled: enabled && Boolean(userId),
    retry: false,
    staleTime: 5 * 60 * 1000,
  }),
});
const createConversationService = defineMutation<
  Conversation,
  CreateConversationInput
>({
  query: (input: CreateConversationInput) => ({
    url: "/internal/conversation",
    baseURL: null,
    method: "POST",
    body: createConversationSchema.parse(input),
    schema: conversationSchema,
  }),
  invalidates: [chatQueryKeys.conversations],
});
const useUsers = createQueryService(usersService),
  useConversations = createQueryService(conversationsService),
  useConversation = createQueryService(conversationService),
  useCurrentUser = createQueryService(currentUserService),
  useCreateConversation = createMutationService(createConversationService);
export function useUsersQuery(enabled = true, limit = 50) {
  return useUsers({ enabled, limit });
}
export function useConversationsQuery(enabled = true, limit = 50) {
  return useConversations({ enabled, limit });
}
export function useConversationQuery(id: string, enabled = true) {
  return useConversation({ id, enabled });
}
export function useCurrentUserQuery(enabled: boolean, userId?: string) {
  return useCurrentUser({ enabled, userId });
}
export function useCreateConversationMutation() {
  return useCreateConversation();
}
export async function createConversation(input: CreateConversationInput) {
  return caller({
    url: "/internal/conversation",
    baseURL: null,
    method: "POST",
    body: createConversationSchema.parse(input),
    schema: conversationSchema,
  });
}
