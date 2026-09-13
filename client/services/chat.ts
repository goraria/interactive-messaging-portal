"use client"

import { z, type ZodType } from "@gorth/structure/cores/zod"
import {
  caller,
  createMutationService,
  createQueryService,
  useMutation,
  useQuery,
} from "@/lib/utils/caller"
import {
  conversationMemberSchema,
  conversationDetailsSchema,
  conversationSchema,
  createConversationMemberSchema,
  createConversationSchema,
  createMessageAttachmentSchema,
  createMessageReactionSchema,
  createMessageReceiptSchema,
  createRoomMessageSchema,
  createUserSchema,
  messageAttachmentSchema,
  messageReactionSchema,
  messageReceiptSchema,
  messageSchema,
  updateConversationMemberSchema,
  updateConversationSchema,
  updateMessageAttachmentSchema,
  updateMessageReceiptSchema,
  updateMessageSchema,
  updateUserSchema,
  userSchema,
  type Conversation,
  type ConversationDetails,
  type ConversationMember,
  type CreateConversationInput,
  type CreateConversationMemberInput,
  type CreateMessageAttachmentInput,
  type CreateMessageReactionInput,
  type CreateMessageReceiptInput,
  type CreateRoomMessageInput,
  type CreateUserInput,
  type Message,
  type MessageAttachment,
  type MessageReaction,
  type MessageReceipt,
  type UpdateConversationInput,
  type UpdateConversationMemberInput,
  type UpdateMessageAttachmentInput,
  type UpdateMessageInput,
  type UpdateMessageReceiptInput,
  type UpdateUserInput,
  type User,
} from "@/schemas/chat"

/* eslint-disable react-hooks/rules-of-hooks -- useQuery/useMutation build service definitions here. */

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE"
  body?: unknown
  params?: Record<string, string | number | boolean | null | undefined>
  proxy?: boolean
}

const listUsersSchema = z.array(userSchema)
const listConversationsSchema = z.array(conversationDetailsSchema)
const listConversationMembersSchema = z.array(
  conversationMemberSchema.extend({
    user: userSchema,
  })
)
const listMessagesSchema = z.array(messageSchema)
const listMessageAttachmentsSchema = z.array(messageAttachmentSchema)
const listMessageReactionsSchema = z.array(messageReactionSchema)
const listMessageReceiptsSchema = z.array(messageReceiptSchema)

export const currentUserQueryKey = ["chat", "current-user"] as const
export const chatQueryKeys = {
  users: ["chat", "user-list"] as const,
  conversations: ["chat", "conversation-list"] as const,
  conversation: (conversationId: string) =>
    ["chat", "conversation", conversationId] as const,
  messages: (conversationId: string) =>
    ["chat", "messages", conversationId] as const,
}

interface ListQueryInput {
  enabled: boolean
  limit: number
}

interface ConversationQueryInput {
  conversationId: string
  enabled: boolean
}

interface ConversationMessagesQueryInput extends ConversationQueryInput {
  limit: number
}

interface CreateConversationMessageVariables {
  conversationId: string
  input: CreateRoomMessageInput
}

interface AddConversationMemberVariables {
  conversationId: string
  input: CreateConversationMemberInput
}

interface CurrentUserQueryInput {
  enabled: boolean
  userId?: string
}

const usersService = useQuery<User[], ListQueryInput>({
  queryKey: ({ limit }: ListQueryInput) =>
    [...chatQueryKeys.users, { limit }] as const,
  query: ({ limit }: ListQueryInput) => ({
    url: "/chat/users",
    method: "GET",
    params: { limit },
    schema: listUsersSchema,
    cache: "no-store",
  }),
  queryOptions: ({ enabled }: ListQueryInput) => ({
    enabled,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  }),
})

const conversationsService = useQuery<ConversationDetails[], ListQueryInput>({
  queryKey: ({ limit }: ListQueryInput) =>
    [...chatQueryKeys.conversations, { limit }] as const,
  query: ({ limit }: ListQueryInput) => ({
    url: "/chat/conversations",
    method: "GET",
    params: { limit },
    schema: listConversationsSchema,
    cache: "no-store",
  }),
  queryOptions: ({ enabled }: ListQueryInput) => ({
    enabled,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  }),
})

const conversationService = useQuery<
  ConversationDetails,
  ConversationQueryInput
>({
  queryKey: ({ conversationId }: ConversationQueryInput) =>
    chatQueryKeys.conversation(conversationId),
  query: ({ conversationId }: ConversationQueryInput) => ({
    url: `/chat/conversations/${encodeURIComponent(conversationId)}`,
    method: "GET",
    schema: conversationDetailsSchema,
    cache: "no-store",
  }),
  queryOptions: ({ conversationId, enabled }: ConversationQueryInput) => ({
    enabled: enabled && Boolean(conversationId),
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  }),
})

const messagesService = useQuery<Message[], ConversationMessagesQueryInput>({
  queryKey: ({ conversationId }: ConversationMessagesQueryInput) =>
    chatQueryKeys.messages(conversationId),
  query: ({ conversationId, limit }: ConversationMessagesQueryInput) => ({
    url: `/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
    method: "GET",
    params: { limit },
    schema: listMessagesSchema,
    cache: "no-store",
  }),
  queryOptions: ({
    conversationId,
    enabled,
  }: ConversationMessagesQueryInput) => ({
    enabled: enabled && Boolean(conversationId),
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  }),
})

const currentUserService = useQuery<User, CurrentUserQueryInput>({
  queryKey: ({ userId }: CurrentUserQueryInput) =>
    [...currentUserQueryKey, userId] as const,
  query: {
    url: "/chat/users/me",
    method: "GET",
    schema: userSchema,
    cache: "no-store",
  },
  queryOptions: ({ enabled, userId }: CurrentUserQueryInput) => ({
    enabled: enabled && Boolean(userId),
    retry: false,
    staleTime: 5 * 60 * 1000,
  }),
})

const createConversationMessageService = useMutation<
  Message,
  CreateConversationMessageVariables
>({
  query: ({ conversationId, input }: CreateConversationMessageVariables) => ({
    url: `/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
    method: "POST",
    body: createRoomMessageSchema.parse(input),
    schema: messageSchema,
  }),
})

const createConversationService = useMutation<
  Conversation,
  CreateConversationInput
>({
  query: (input: CreateConversationInput) => ({
    url: "/chat/conversations",
    method: "POST",
    body: createConversationSchema.parse(input),
    schema: conversationSchema,
  }),
  invalidates: [chatQueryKeys.conversations],
})

const addConversationMemberService = useMutation<
  ConversationMember,
  AddConversationMemberVariables
>({
  query: ({ conversationId, input }: AddConversationMemberVariables) => ({
    url: `/chat/conversations/${encodeURIComponent(conversationId)}/members`,
    method: "POST",
    body: createConversationMemberSchema.parse(input),
    schema: conversationMemberSchema,
  }),
  invalidates: (_member, { conversationId }) => [
    chatQueryKeys.conversation(conversationId),
    chatQueryKeys.conversations,
  ],
})

const useUsers = createQueryService(usersService)
const useConversations = createQueryService(conversationsService)
const useConversation = createQueryService(conversationService)
const useConversationMessages = createQueryService(messagesService)
const useCurrentUser = createQueryService(currentUserService)
const useCreateConversationMessage = createMutationService(
  createConversationMessageService
)
const useCreateConversation = createMutationService(createConversationService)
const useAddConversationMember = createMutationService(
  addConversationMemberService
)

export function useUsersQuery(enabled = true, limit = 50) {
  return useUsers({ enabled, limit })
}

export function useConversationsQuery(enabled = true, limit = 50) {
  return useConversations({ enabled, limit })
}

export function useConversationQuery(conversationId: string, enabled = true) {
  return useConversation({ conversationId, enabled })
}

export function useConversationMessagesQuery(
  conversationId: string,
  enabled = true,
  limit = 80
) {
  return useConversationMessages({ conversationId, enabled, limit })
}

export function useCreateConversationMessageMutation(conversationId: string) {
  const [trigger, state] = useCreateConversationMessage()

  return [
    (input: CreateRoomMessageInput) => trigger({ conversationId, input }),
    state,
  ] as const
}

export function useCurrentUserQuery(enabled: boolean, userId?: string) {
  return useCurrentUser({ enabled, userId })
}

export function useCreateConversationMutation() {
  return useCreateConversation()
}

export function useAddConversationMemberMutation() {
  return useAddConversationMember()
}

export function mergeMessageResults(current: Message[], incoming: Message[]) {
  const messages = new Map(current.map((message) => [message.id, message]))

  for (const message of incoming) {
    messages.set(message.id, message)
  }

  return Array.from(messages.values()).sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  )
}

async function request<T>(
  path: string,
  schema: ZodType<T>,
  options: RequestOptions = {}
) {
  return caller<T>({
    baseURL: options.proxy ? null : undefined,
    url: path,
    method: options.method ?? "GET",
    body: options.body,
    params: options.params,
    schema,
    cache: "no-store",
    credentials: "include",
  })
}

export async function listUsers(limit = 50): Promise<User[]> {
  return request("/chat/users", listUsersSchema, {
    params: { limit },
  })
}

export async function getCurrentUser(): Promise<User> {
  return request("/chat/users/me", userSchema)
}

export async function createUser(input: CreateUserInput): Promise<User> {
  return request("/chat/users", userSchema, {
    method: "POST",
    body: createUserSchema.parse(input),
  })
}

export async function getUser(userId: string): Promise<User> {
  return request(`/chat/users/${encodeURIComponent(userId)}`, userSchema)
}

export async function updateUser(
  userId: string,
  input: UpdateUserInput
): Promise<User> {
  return request(`/chat/users/${encodeURIComponent(userId)}`, userSchema, {
    method: "PATCH",
    body: updateUserSchema.parse(input),
  })
}

export async function deleteUser(userId: string): Promise<User> {
  return request(`/chat/users/${encodeURIComponent(userId)}`, userSchema, {
    method: "DELETE",
  })
}

export async function listConversations(
  limit = 50
): Promise<ConversationDetails[]> {
  return request("/chat/conversations", listConversationsSchema, {
    params: { limit },
  })
}

export async function createConversation(
  input: CreateConversationInput
): Promise<Conversation> {
  return request("/chat/conversations", conversationSchema, {
    method: "POST",
    body: createConversationSchema.parse(input),
  })
}

export async function getConversation(
  conversationId: string
): Promise<ConversationDetails> {
  return request(
    `/chat/conversations/${encodeURIComponent(conversationId)}`,
    conversationDetailsSchema
  )
}

export async function updateConversation(
  conversationId: string,
  input: UpdateConversationInput
): Promise<Conversation> {
  return request(
    `/chat/conversations/${encodeURIComponent(conversationId)}`,
    conversationSchema,
    {
      method: "PATCH",
      body: updateConversationSchema.parse(input),
    }
  )
}

export async function deleteConversation(
  conversationId: string
): Promise<Conversation> {
  return request(
    `/chat/conversations/${encodeURIComponent(conversationId)}`,
    conversationSchema,
    {
      method: "DELETE",
    }
  )
}

export async function listConversationMembers(conversationId: string) {
  return request(
    `/chat/conversations/${encodeURIComponent(conversationId)}/members`,
    listConversationMembersSchema
  )
}

export async function addConversationMember(
  conversationId: string,
  input: CreateConversationMemberInput
): Promise<ConversationMember> {
  return request(
    `/chat/conversations/${encodeURIComponent(conversationId)}/members`,
    conversationMemberSchema,
    {
      method: "POST",
      body: createConversationMemberSchema.parse(input),
    }
  )
}

export async function updateConversationMember(
  conversationId: string,
  userId: string,
  input: UpdateConversationMemberInput
): Promise<ConversationMember> {
  return request(
    `/chat/conversations/${encodeURIComponent(conversationId)}/members/${encodeURIComponent(userId)}`,
    conversationMemberSchema,
    {
      method: "PATCH",
      body: updateConversationMemberSchema.parse(input),
    }
  )
}

export async function removeConversationMember(
  conversationId: string,
  userId: string
): Promise<ConversationMember> {
  return request(
    `/chat/conversations/${encodeURIComponent(conversationId)}/members/${encodeURIComponent(userId)}`,
    conversationMemberSchema,
    {
      method: "DELETE",
    }
  )
}

export async function listConversationMessages(
  conversationId: string,
  limit = 50
): Promise<Message[]> {
  return request(
    `/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
    listMessagesSchema,
    {
      params: { limit },
    }
  )
}

export async function createConversationMessage(
  conversationId: string,
  input: CreateRoomMessageInput
): Promise<Message> {
  return request(
    `/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
    messageSchema,
    {
      method: "POST",
      body: createRoomMessageSchema.parse(input),
    }
  )
}

export async function getMessage(messageId: string): Promise<Message> {
  return request(
    `/chat/messages/${encodeURIComponent(messageId)}`,
    messageSchema
  )
}

export async function updateMessage(
  messageId: string,
  input: UpdateMessageInput
): Promise<Message> {
  return request(
    `/chat/messages/${encodeURIComponent(messageId)}`,
    messageSchema,
    {
      method: "PATCH",
      body: updateMessageSchema.parse(input),
    }
  )
}

export async function deleteMessage(messageId: string): Promise<Message> {
  return request(
    `/chat/messages/${encodeURIComponent(messageId)}`,
    messageSchema,
    {
      method: "DELETE",
    }
  )
}

export async function listRoomMessages(
  roomName: string,
  limit = 80
): Promise<Message[]> {
  return request(
    `/chat/rooms/${encodeURIComponent(roomName)}/messages`,
    listMessagesSchema,
    {
      proxy: true,
      params: { limit },
    }
  )
}

export async function createRoomMessage(
  roomName: string,
  input: CreateRoomMessageInput
): Promise<Message> {
  return request(
    `/chat/rooms/${encodeURIComponent(roomName)}/messages`,
    messageSchema,
    {
      proxy: true,
      method: "POST",
      body: createRoomMessageSchema.parse(input),
    }
  )
}

export async function listMessageAttachments(
  messageId: string
): Promise<MessageAttachment[]> {
  return request(
    `/chat/messages/${encodeURIComponent(messageId)}/attachments`,
    listMessageAttachmentsSchema
  )
}

export async function createMessageAttachment(
  messageId: string,
  input: CreateMessageAttachmentInput
): Promise<MessageAttachment> {
  return request(
    `/chat/messages/${encodeURIComponent(messageId)}/attachments`,
    messageAttachmentSchema,
    {
      method: "POST",
      body: createMessageAttachmentSchema.parse(input),
    }
  )
}

export async function updateMessageAttachment(
  attachmentId: string,
  input: UpdateMessageAttachmentInput
): Promise<MessageAttachment> {
  return request(
    `/chat/attachments/${encodeURIComponent(attachmentId)}`,
    messageAttachmentSchema,
    {
      method: "PATCH",
      body: updateMessageAttachmentSchema.parse(input),
    }
  )
}

export async function deleteMessageAttachment(
  attachmentId: string
): Promise<MessageAttachment> {
  return request(
    `/chat/attachments/${encodeURIComponent(attachmentId)}`,
    messageAttachmentSchema,
    {
      method: "DELETE",
    }
  )
}

export async function listMessageReactions(
  messageId: string
): Promise<MessageReaction[]> {
  return request(
    `/chat/messages/${encodeURIComponent(messageId)}/reactions`,
    listMessageReactionsSchema
  )
}

export async function createMessageReaction(
  messageId: string,
  input: CreateMessageReactionInput
): Promise<MessageReaction | null> {
  return request(
    `/chat/messages/${encodeURIComponent(messageId)}/reactions`,
    messageReactionSchema.nullable(),
    {
      method: "POST",
      body: createMessageReactionSchema.parse(input),
    }
  )
}

export async function deleteMessageReaction(
  reactionId: string
): Promise<MessageReaction> {
  return request(
    `/chat/reactions/${encodeURIComponent(reactionId)}`,
    messageReactionSchema,
    {
      method: "DELETE",
    }
  )
}

export async function listMessageReceipts(
  messageId: string
): Promise<MessageReceipt[]> {
  return request(
    `/chat/messages/${encodeURIComponent(messageId)}/receipts`,
    listMessageReceiptsSchema
  )
}

export async function createMessageReceipt(
  messageId: string,
  input: CreateMessageReceiptInput
): Promise<MessageReceipt> {
  return request(
    `/chat/messages/${encodeURIComponent(messageId)}/receipts`,
    messageReceiptSchema,
    {
      method: "POST",
      body: createMessageReceiptSchema.parse(input),
    }
  )
}

export async function updateMessageReceipt(
  receiptId: string,
  input: UpdateMessageReceiptInput
): Promise<MessageReceipt> {
  return request(
    `/chat/receipts/${encodeURIComponent(receiptId)}`,
    messageReceiptSchema,
    {
      method: "PATCH",
      body: updateMessageReceiptSchema.parse(input),
    }
  )
}

export async function deleteMessageReceipt(
  receiptId: string
): Promise<MessageReceipt> {
  return request(
    `/chat/receipts/${encodeURIComponent(receiptId)}`,
    messageReceiptSchema,
    {
      method: "DELETE",
    }
  )
}
