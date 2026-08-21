"use client"

import { z, type ZodType } from "@gorth/structure/cores/zod"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@gorth/primitive/cores/tanstack/query"
import { apiBaseUrl } from "@/lib/utils/environment"
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

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE"
  body?: unknown
  params?: Record<string, string | number | boolean | null | undefined>
  proxy?: boolean
}

interface ApiEnvelope {
  data?: unknown
  error?: string
  issues?: unknown
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
let authRefreshRequest: Promise<Response> | null = null

export const currentUserQueryKey = ["chat", "current-user"] as const
export const chatQueryKeys = {
  users: ["chat", "user-list"] as const,
  conversations: ["chat", "conversation-list"] as const,
  conversation: (conversationId: string) =>
    ["chat", "conversation", conversationId] as const,
  messages: (conversationId: string) =>
    ["chat", "messages", conversationId] as const,
}

export function useUsersQuery(enabled = true, limit = 50) {
  return useQuery({
    queryKey: [...chatQueryKeys.users, { limit }],
    queryFn: () => listUsers(limit),
    enabled,
    retry: false,
    staleTime: 30_000,
  })
}

export function useConversationsQuery(enabled = true, limit = 50) {
  return useQuery({
    queryKey: [...chatQueryKeys.conversations, { limit }],
    queryFn: () => listConversations(limit),
    enabled,
    retry: false,
    staleTime: 30_000,
  })
}

export function useConversationQuery(conversationId: string, enabled = true) {
  return useQuery({
    queryKey: chatQueryKeys.conversation(conversationId),
    queryFn: () => getConversation(conversationId),
    enabled: enabled && Boolean(conversationId),
    retry: false,
    staleTime: 30_000,
  })
}

export function useConversationMessagesQuery(
  conversationId: string,
  enabled = true,
  limit = 80
) {
  return useQuery({
    queryKey: chatQueryKeys.messages(conversationId),
    queryFn: () => listConversationMessages(conversationId, limit),
    enabled: enabled && Boolean(conversationId),
    retry: false,
    staleTime: 30_000,
  })
}

export function useCreateConversationMessageMutation(conversationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateRoomMessageInput) =>
      createConversationMessage(conversationId, input),
    onSuccess: (message) => {
      queryClient.setQueryData<Message[]>(
        chatQueryKeys.messages(conversationId),
        (current = []) => mergeMessageResults(current, [message])
      )
      queryClient.setQueryData<ConversationDetails>(
        chatQueryKeys.conversation(conversationId),
        (current) =>
          current
            ? {
              ...current,
              lastMessage: message,
              updatedAt: message.createdAt,
            }
            : current
      )
      void queryClient.invalidateQueries({
        queryKey: chatQueryKeys.conversations,
      })
    },
  })
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

function getApiBaseUrl() {
  return apiBaseUrl ?? "http://localhost:5050"
}

function withQuery(path: string, params?: RequestOptions["params"]) {
  if (!params) {
    return path
  }

  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) {
      search.set(key, String(value))
    }
  }

  const query = search.toString()

  return query ? `${path}?${query}` : path
}

function refreshAuthentication() {
  if (authRefreshRequest) return authRefreshRequest

  authRefreshRequest = fetch("/auth/me", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  }).finally(() => {
    authRefreshRequest = null
  })

  return authRefreshRequest
}

async function request<T>(
  path: string,
  schema: ZodType<T>,
  options: RequestOptions = {}
) {
  const targetPath = withQuery(path, options.params)
  const url = options.proxy
    ? targetPath
    : new URL(targetPath, getApiBaseUrl()).toString()
  const send = () =>
    fetch(url, {
      method: options.method ?? "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    })

  let response = await send()

  if (response.status === 401) {
    const authResponse = await refreshAuthentication()

    if (authResponse.ok) {
      // The auth route owns refresh-token rotation. Retry this API call once.
      response = await send()
    } else if (authResponse.status === 401) {
      window.location.replace("/")
    }
  }

  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope

  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed with ${response.status}`)
  }

  return schema.parse(payload.data)
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
    `/api/chat/rooms/${encodeURIComponent(roomName)}/messages`,
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
    `/api/chat/rooms/${encodeURIComponent(roomName)}/messages`,
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
