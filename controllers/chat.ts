import type { Context } from "hono";
import type { ApiEnv } from "@/utils/interface";
import { getVerifiedUser, getParam, parseBody } from "@/utils/controller";
import { rawGetCurrentUserRow } from "@/models/user";
import { rawReadAppCredentials } from "@/models/session";
import { createServiceError } from "@/utils/service";
import * as schema from "@/schemas/chat-domain";
import {
  rawListChatConversations as listChatConversationsServices,
  rawGetChatConversation as getChatConversationServices,
  rawStartChatConversation as startChatConversationServices,
  rawChangeChatConversation as changeChatConversationServices,
  rawListChatMembers as listChatMembersServices,
  rawChangeChatMember as changeChatMemberServices,
  rawSetChatMute as setChatMuteServices,
  rawSetChatBlock as setChatBlockServices,
} from "@/models/conversation";
import {
  rawListChatMessages as listChatMessagesServices,
  rawGetChatMessage as getChatMessageServices,
  rawSendChatMessage as sendChatMessageServices,
  rawEditChatMessage as editChatMessageServices,
  rawDeleteChatMessage as deleteChatMessageServices,
  rawReactChatMessage as reactChatMessageServices,
  rawAcknowledgeChatMessage as acknowledgeChatMessageServices,
  rawReplayChatEvents as replayChatEventsServices,
} from "@/models/message";
import {
  rawCreateChatUpload as createChatUploadServices,
  rawFinishChatUpload as finishChatUploadServices,
  rawDownloadChatAttachment as downloadChatAttachmentServices,
  rawChatStorageCredential as chatStorageCredentialServices,
} from "@/services/chat-media";
import {
  rawListChatCalls as listChatCallsServices,
  rawStartChatCall as startChatCallServices,
  rawSignalChatCall as signalChatCallServices,
  rawListChatSignals as listChatSignalsServices,
  rawChatIceConfiguration as chatIceConfigurationServices,
} from "@/models/chat-call";
import { rawDispatchChatEvents as dispatchChatEventsServices } from "@/models/chat-delivery";
import { rawIncomingChatCalls as incomingChatCallsServices } from "@/models/chat-call";
import { rawRetryChatDelivery as retryChatDeliveryServices } from "@/models/chat-delivery";
import { rawChatDeliveryStatus as chatDeliveryStatusServices } from "@/models/chat-delivery";
import { rawSearchChatMessages as searchChatMessagesServices } from "@/models/message";
import { rawReportChatMessage as reportChatMessageServices } from "@/services/chat-reports";
import { rawArchiveChatConversation as archiveChatConversationServices } from "@/models/conversation";
import { measureRequest } from "@/utils/server/timing";

async function actor(context: Context<ApiEnv>) {
  const auth = getVerifiedUser(context);
  if (!auth) throw createServiceError(401, "unauthorized");
  return measureRequest("actor", () => rawGetCurrentUserRow(auth));
}
async function delegatedToken(context: Context<ApiEnv>) {
  const bearer = context.req.header("authorization");
  if (bearer?.startsWith("Bearer ")) return bearer.slice(7);
  const credentials = await rawReadAppCredentials(context.req.raw.headers);
  if (!credentials) throw createServiceError(401, "unauthorized");
  return credentials.credentials.accessToken;
}
function id(context: Context<ApiEnv>, name = "id") {
  return schema.chatId.parse(getParam(context, name));
}
export async function actListChatConversations(context: Context<ApiEnv>) {
  const user = await actor(context);
  const query = schema.chatPageSchema.parse(context.req.query());
  return context.json(
    { data: await listChatConversationsServices(user.id, query.limit) },
    200,
  );
}
export async function actGetChatConversation(context: Context<ApiEnv>) {
  const user = await actor(context);
  return context.json(
    { data: await getChatConversationServices(id(context), user.id) },
    200,
  );
}
export async function actStartChatConversation(context: Context<ApiEnv>) {
  const user = await actor(context);
  return context.json(
    {
      data: await startChatConversationServices(
        user.id,
        await parseBody(schema.startConversationSchema, context),
      ),
    },
    201,
  );
}
export async function actChangeChatConversation(context: Context<ApiEnv>) {
  const user = await actor(context);
  return context.json(
    {
      data: await changeChatConversationServices(
        id(context),
        user.id,
        await parseBody(schema.changeConversationSchema, context),
      ),
    },
    200,
  );
}
export async function actArchiveChatConversation(context: Context<ApiEnv>) {
  const user = await actor(context);
  return context.json(
    {
      data: await archiveChatConversationServices(id(context), user.id),
    },
    200,
  );
}
export async function actListChatMembers(context: Context<ApiEnv>) {
  const user = await actor(context);
  return context.json(
    { data: await listChatMembersServices(id(context), user.id) },
    200,
  );
}
export async function actChangeChatMember(context: Context<ApiEnv>) {
  const user = await actor(context);
  const operation =
    context.req.method === "POST"
      ? "add"
      : context.req.method === "DELETE"
        ? "remove"
        : "role";
  const input =
    operation === "remove"
      ? { userId: id(context, "userId"), role: "member" as const }
      : operation === "role"
        ? {
            ...(await parseBody(schema.memberRoleSchema, context)),
            userId: id(context, "userId"),
          }
        : await parseBody(schema.memberChangeSchema, context);
  return context.json(
    {
      data: await changeChatMemberServices(
        id(context),
        user.id,
        input.userId,
        operation,
        input.role,
      ),
    },
    200,
  );
}
export async function actSetChatMute(context: Context<ApiEnv>) {
  const user = await actor(context);
  const input = await parseBody(schema.memberPreferencesSchema, context);
  return context.json(
    { data: await setChatMuteServices(id(context), user.id, input.mutedUntil) },
    200,
  );
}
export async function actSetChatBlock(context: Context<ApiEnv>) {
  const user = await actor(context);
  return context.json(
    {
      data: await setChatBlockServices(
        user.id,
        id(context),
        context.req.method === "POST",
      ),
    },
    200,
  );
}
export async function actListChatMessages(context: Context<ApiEnv>) {
  const user = await actor(context);
  return context.json(
    await listChatMessagesServices(
      id(context),
      user.id,
      schema.chatPageSchema.parse(context.req.query()),
    ),
    200,
  );
}
export async function actGetChatMessage(context: Context<ApiEnv>) {
  const user = await actor(context);
  return context.json(
    { data: await getChatMessageServices(id(context), user.id) },
    200,
  );
}
export async function actSendChatMessage(context: Context<ApiEnv>) {
  const user = await actor(context);
  return context.json(
    {
      data: await sendChatMessageServices(
        id(context),
        user.id,
        user.externalUserId,
        await parseBody(schema.sendChatMessageSchema, context),
      ),
    },
    201,
  );
}
export async function actEditChatMessage(context: Context<ApiEnv>) {
  const user = await actor(context);
  const input = await parseBody(schema.editChatMessageSchema, context);
  return context.json(
    {
      data: await editChatMessageServices(
        id(context),
        user.id,
        input.content,
        input.version,
      ),
    },
    200,
  );
}
export async function actDeleteChatMessage(context: Context<ApiEnv>) {
  const user = await actor(context);
  return context.json(
    {
      data: await deleteChatMessageServices(id(context), user.id),
    },
    200,
  );
}
export async function actReactChatMessage(context: Context<ApiEnv>) {
  const user = await actor(context);
  const input = await parseBody(schema.reactionInputSchema, context);
  return context.json(
    {
      data: await reactChatMessageServices(
        id(context),
        user.id,
        input.emoji,
        context.req.method === "DELETE",
      ),
    },
    200,
  );
}
export async function actAcknowledgeChatMessage(context: Context<ApiEnv>) {
  const user = await actor(context);
  const input = await parseBody(schema.receiptInputSchema, context);
  return context.json(
    {
      data: await acknowledgeChatMessageServices(
        id(context),
        user.id,
        input.status,
      ),
    },
    200,
  );
}
export async function actReplayChatEvents(context: Context<ApiEnv>) {
  const user = await actor(context);
  const cursor = schema.signalCursorSchema.parse(context.req.query());
  return context.json(
    {
      data: await replayChatEventsServices(id(context), user.id, cursor.after),
    },
    200,
  );
}
export async function actCreateChatUpload(context: Context<ApiEnv>) {
  const user = await actor(context);
  return context.json(
    {
      data: await createChatUploadServices(
        id(context),
        user.id,
        await delegatedToken(context),
        await parseBody(schema.uploadInputSchema, context),
      ),
    },
    201,
  );
}
export async function actFinishChatUpload(context: Context<ApiEnv>) {
  const user = await actor(context);
  return context.json(
    {
      data: await finishChatUploadServices(
        id(context),
        user.id,
        await delegatedToken(context),
        id(context, "uploadId"),
        context.req.path.endsWith("/abort"),
      ),
    },
    200,
  );
}
export async function actDownloadChatAttachment(context: Context<ApiEnv>) {
  const user = await actor(context);
  const result = await downloadChatAttachmentServices(
    id(context, "attachmentId"),
    user.id,
  );
  context.header("Referrer-Policy", "no-referrer");
  return context.redirect(result.url, 307);
}
export async function actListChatCalls(context: Context<ApiEnv>) {
  const user = await actor(context);
  return context.json(
    { data: await listChatCallsServices(id(context), user.id) },
    200,
  );
}
export async function actIncomingChatCalls(context: Context<ApiEnv>) {
  const user = await actor(context);
  return context.json({ data: await incomingChatCallsServices(user.id) }, 200);
}
export async function actStartChatCall(context: Context<ApiEnv>) {
  const user = await actor(context);
  const input = await parseBody(schema.callStartSchema, context);
  return context.json(
    {
      data: await startChatCallServices(
        id(context),
        user.id,
        input.kind,
        input.clientId,
      ),
    },
    201,
  );
}
export async function actSignalChatCall(context: Context<ApiEnv>) {
  const user = await actor(context);
  return context.json(
    {
      data: await signalChatCallServices(
        id(context),
        user.id,
        await parseBody(schema.callSignalSchema, context),
      ),
    },
    200,
  );
}
export async function actListChatSignals(context: Context<ApiEnv>) {
  const user = await actor(context);
  const cursor = schema.signalCursorSchema.parse(context.req.query());
  return context.json(
    await listChatSignalsServices(id(context), user.id, cursor.after),
    200,
  );
}
export async function actChatIceConfiguration(context: Context<ApiEnv>) {
  return context.json({ data: chatIceConfigurationServices() }, 200);
}
export async function actDispatchChatEvents(context: Context<ApiEnv>) {
  return context.json(await dispatchChatEventsServices(), 200);
}
export async function actRetryChatDelivery(context: Context<ApiEnv>) {
  const user = await actor(context);
  return context.json(
    {
      data: await retryChatDeliveryServices(
        id(context),
        user.id,
        id(context, "eventId"),
      ),
    },
    200,
  );
}
export async function actChatStorageCredential(context: Context<ApiEnv>) {
  const input = await parseBody(schema.storageRequestSchema, context);
  context.header("Cache-Control", "private, no-store");
  context.header("Pragma", "no-cache");
  return context.json(chatStorageCredentialServices(input.bucketName), 200);
}
export async function actReportChatMessage(context: Context<ApiEnv>) {
  const user = await actor(context);
  const input = await parseBody(schema.reportInputSchema, context);
  return context.json(
    {
      data: await reportChatMessageServices(
        id(context),
        user.id,
        await delegatedToken(context),
        input,
      ),
    },
    201,
  );
}
export async function actSearchChatMessages(context: Context<ApiEnv>) {
  const user = await actor(context);
  const input = schema.chatPageSchema.parse(context.req.query());
  return context.json(
    {
      data: await searchChatMessagesServices(
        id(context),
        user.id,
        input.q,
        input.limit,
      ),
    },
    200,
  );
}
export async function actChatDeliveryStatus(context: Context<ApiEnv>) {
  const user = await actor(context);
  return context.json(
    { data: await chatDeliveryStatusServices(id(context), user.id) },
    200,
  );
}
