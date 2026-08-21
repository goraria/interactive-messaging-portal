import type { Request, Response } from "express"
import { ZodError, type ZodType } from "@gorth/structure/cores/zod"
import type { AuthContext } from "@/middlewares/auth"
import {
  createConversationSchema,
  createConversationMemberSchema,
  createMessageAttachmentSchema,
  createMessageReactionSchema,
  createMessageReceiptSchema,
  createRoomMessageSchema,
  createUserSchema,
  listQuerySchema,
  updateConversationSchema,
  updateConversationMemberSchema,
  updateMessageAttachmentSchema,
  updateMessageReceiptSchema,
  updateMessageSchema,
  updateUserSchema,
} from "@/schemas/chat"
import * as chat from "@/services/chat"
import type { AuthUserInput, ServiceError } from "@/services/chat"

function getParam(req: Request, name: string) {
  const value = req.params[name]

  return (Array.isArray(value) ? value[0] : value)?.trim() ?? ""
}

function getAuthUser(req: Request): AuthUserInput | null {
  const id = decodeURIComponent(req.get("x-gorth-user-id")?.trim() ?? "")
  const name = decodeURIComponent(req.get("x-gorth-user-name")?.trim() ?? "")
  const email = decodeURIComponent(req.get("x-gorth-user-email")?.trim() ?? "")

  if (!id || !name) {
    return null
  }

  return {
    id,
    name,
    email: email || undefined,
  }
}

function getVerifiedUser(res: Response): AuthUserInput | null {
  const auth = res.locals.auth as AuthContext | undefined

  if (!auth?.user) {
    return null
  }

  return {
    id: auth.user.id,
    name: auth.user.name ?? auth.user.email.split("@")[0] ?? auth.user.email,
    email: auth.user.email,
    image: auth.user.image,
  }
}

function parseBody<T>(schema: ZodType<T>, req: Request) {
  return schema.parse(req.body ?? {})
}

function parseListLimit(req: Request) {
  return listQuerySchema.parse(req.query).limit
}

function sendData(res: Response, data: unknown, status = 200) {
  return res.status(status).json({ data })
}

function sendError(res: Response, cause: unknown) {
  if (cause instanceof ZodError) {
    return res.status(400).json({
      error: "validation_failed",
      issues: cause.issues,
    })
  }

  const serviceError = cause as Partial<ServiceError>

  if (typeof serviceError.statusCode === "number" && serviceError.code) {
    return res.status(serviceError.statusCode).json({ error: serviceError.code })
  }

  throw cause
}

export async function listUsers(req: Request, res: Response) {
  try {
    return sendData(res, await chat.listUsers(parseListLimit(req)))
  } catch (cause) {
    return sendError(res, cause)
  }
}

export async function getCurrentUser(_req: Request, res: Response) {
  try {
    const authUser = getVerifiedUser(res)

    if (!authUser) {
      return res.status(401).json({ error: "unauthorized" })
    }

    return sendData(res, await chat.getCurrentUser(authUser))
  } catch (cause) {
    return sendError(res, cause)
  }
}

export async function createUser(req: Request, res: Response) {
  try {
    return sendData(res, await chat.createUser(parseBody(createUserSchema, req)), 201)
  } catch (cause) {
    return sendError(res, cause)
  }
}

export async function getUser(req: Request, res: Response) {
  try {
    return sendData(res, await chat.getUser(getParam(req, "userId")))
  } catch (cause) {
    return sendError(res, cause)
  }
}

export async function updateUser(req: Request, res: Response) {
  try {
    return sendData(
      res,
      await chat.updateUser(getParam(req, "userId"), parseBody(updateUserSchema, req)),
    )
  } catch (cause) {
    return sendError(res, cause)
  }
}

export async function deleteUser(req: Request, res: Response) {
  try {
    return sendData(res, await chat.deleteUser(getParam(req, "userId")))
  } catch (cause) {
    return sendError(res, cause)
  }
}

export async function listConversations(req: Request, res: Response) {
  try {
    const authUser = getVerifiedUser(res)

    if (!authUser) {
      return res.status(401).json({ error: "unauthorized" })
    }

    return sendData(
      res,
      await chat.listConversations(authUser, parseListLimit(req)),
    )
  } catch (cause) {
    return sendError(res, cause)
  }
}

export async function createConversation(req: Request, res: Response) {
  try {
    return sendData(
      res,
      await chat.createConversation(parseBody(createConversationSchema, req)),
      201,
    )
  } catch (cause) {
    return sendError(res, cause)
  }
}

export async function getConversation(req: Request, res: Response) {
  try {
    const authUser = getVerifiedUser(res)

    if (!authUser) {
      return res.status(401).json({ error: "unauthorized" })
    }

    return sendData(
      res,
      await chat.getConversation(authUser, getParam(req, "conversationId")),
    )
  } catch (cause) {
    return sendError(res, cause)
  }
}

export async function updateConversation(req: Request, res: Response) {
  try {
    return sendData(
      res,
      await chat.updateConversation(
        getParam(req, "conversationId"),
        parseBody(updateConversationSchema, req),
      ),
    )
  } catch (cause) {
    return sendError(res, cause)
  }
}

export async function deleteConversation(req: Request, res: Response) {
  try {
    return sendData(res, await chat.deleteConversation(getParam(req, "conversationId")))
  } catch (cause) {
    return sendError(res, cause)
  }
}

export async function listConversationMembers(req: Request, res: Response) {
  try {
    return sendData(res, await chat.listConversationMembers(getParam(req, "conversationId")))
  } catch (cause) {
    return sendError(res, cause)
  }
}

export async function addConversationMember(req: Request, res: Response) {
  try {
    return sendData(
      res,
      await chat.addConversationMember(
        getParam(req, "conversationId"),
        parseBody(createConversationMemberSchema, req),
      ),
      201,
    )
  } catch (cause) {
    return sendError(res, cause)
  }
}

export async function updateConversationMember(req: Request, res: Response) {
  try {
    return sendData(
      res,
      await chat.updateConversationMember(
        getParam(req, "conversationId"),
        getParam(req, "userId"),
        parseBody(updateConversationMemberSchema, req),
      ),
    )
  } catch (cause) {
    return sendError(res, cause)
  }
}

export async function removeConversationMember(req: Request, res: Response) {
  try {
    return sendData(
      res,
      await chat.removeConversationMember(
        getParam(req, "conversationId"),
        getParam(req, "userId"),
      ),
    )
  } catch (cause) {
    return sendError(res, cause)
  }
}

export async function listConversationMessages(req: Request, res: Response) {
  try {
    const authUser = getVerifiedUser(res)

    if (!authUser) {
      return res.status(401).json({ error: "unauthorized" })
    }

    return sendData(
      res,
      await chat.listConversationMessages(
        authUser,
        getParam(req, "conversationId"),
        parseListLimit(req),
      ),
    )
  } catch (cause) {
    return sendError(res, cause)
  }
}

export async function createConversationMessage(req: Request, res: Response) {
  try {
    const authUser = getVerifiedUser(res)

    if (!authUser) {
      return res.status(401).json({ error: "unauthorized" })
    }

    return sendData(
      res,
      await chat.createConversationMessage(
        authUser,
        getParam(req, "conversationId"),
        parseBody(createRoomMessageSchema, req),
      ),
      201,
    )
  } catch (cause) {
    return sendError(res, cause)
  }
}

export async function getMessage(req: Request, res: Response) {
  try {
    return sendData(res, await chat.getMessage(getParam(req, "messageId")))
  } catch (cause) {
    return sendError(res, cause)
  }
}

export async function updateMessage(req: Request, res: Response) {
  try {
    return sendData(
      res,
      await chat.updateMessage(getParam(req, "messageId"), parseBody(updateMessageSchema, req)),
    )
  } catch (cause) {
    return sendError(res, cause)
  }
}

export async function deleteMessage(req: Request, res: Response) {
  try {
    return sendData(res, await chat.deleteMessage(getParam(req, "messageId")))
  } catch (cause) {
    return sendError(res, cause)
  }
}

export async function listRoomMessages(req: Request, res: Response) {
  try {
    return sendData(
      res,
      await chat.listRoomMessages(getParam(req, "roomName"), parseListLimit(req)),
    )
  } catch (cause) {
    return sendError(res, cause)
  }
}

export async function createRoomMessage(req: Request, res: Response) {
  try {
    const authUser = getAuthUser(req)

    if (!authUser) {
      return res.status(401).json({ error: "unauthorized" })
    }

    return sendData(
      res,
      await chat.createRoomMessage(
        getParam(req, "roomName"),
        authUser,
        parseBody(createRoomMessageSchema, req),
      ),
      201,
    )
  } catch (cause) {
    return sendError(res, cause)
  }
}

export async function listMessageAttachments(req: Request, res: Response) {
  try {
    return sendData(res, await chat.listMessageAttachments(getParam(req, "messageId")))
  } catch (cause) {
    return sendError(res, cause)
  }
}

export async function createMessageAttachment(req: Request, res: Response) {
  try {
    return sendData(
      res,
      await chat.createMessageAttachment(
        getParam(req, "messageId"),
        parseBody(createMessageAttachmentSchema, req),
      ),
      201,
    )
  } catch (cause) {
    return sendError(res, cause)
  }
}

export async function updateMessageAttachment(req: Request, res: Response) {
  try {
    return sendData(
      res,
      await chat.updateMessageAttachment(
        getParam(req, "attachmentId"),
        parseBody(updateMessageAttachmentSchema, req),
      ),
    )
  } catch (cause) {
    return sendError(res, cause)
  }
}

export async function deleteMessageAttachment(req: Request, res: Response) {
  try {
    return sendData(res, await chat.deleteMessageAttachment(getParam(req, "attachmentId")))
  } catch (cause) {
    return sendError(res, cause)
  }
}

export async function listMessageReactions(req: Request, res: Response) {
  try {
    return sendData(res, await chat.listMessageReactions(getParam(req, "messageId")))
  } catch (cause) {
    return sendError(res, cause)
  }
}

export async function createMessageReaction(req: Request, res: Response) {
  try {
    return sendData(
      res,
      await chat.createMessageReaction(
        getParam(req, "messageId"),
        parseBody(createMessageReactionSchema, req),
      ),
      201,
    )
  } catch (cause) {
    return sendError(res, cause)
  }
}

export async function deleteMessageReaction(req: Request, res: Response) {
  try {
    return sendData(res, await chat.deleteMessageReaction(getParam(req, "reactionId")))
  } catch (cause) {
    return sendError(res, cause)
  }
}

export async function listMessageReceipts(req: Request, res: Response) {
  try {
    return sendData(res, await chat.listMessageReceipts(getParam(req, "messageId")))
  } catch (cause) {
    return sendError(res, cause)
  }
}

export async function createMessageReceipt(req: Request, res: Response) {
  try {
    return sendData(
      res,
      await chat.createMessageReceipt(
        getParam(req, "messageId"),
        parseBody(createMessageReceiptSchema, req),
      ),
      201,
    )
  } catch (cause) {
    return sendError(res, cause)
  }
}

export async function updateMessageReceipt(req: Request, res: Response) {
  try {
    return sendData(
      res,
      await chat.updateMessageReceipt(
        getParam(req, "receiptId"),
        parseBody(updateMessageReceiptSchema, req),
      ),
    )
  } catch (cause) {
    return sendError(res, cause)
  }
}

export async function deleteMessageReceipt(req: Request, res: Response) {
  try {
    return sendData(res, await chat.deleteMessageReceipt(getParam(req, "receiptId")))
  } catch (cause) {
    return sendError(res, cause)
  }
}
