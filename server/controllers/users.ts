import type { Request, Response } from "express"
import { createUserSchema, updateUserSchema } from "@/schemas/chat"
import {
  createUser as createUserService,
  deleteUser as deleteUserService,
  getCurrentUser as getCurrentUserService,
  getCurrentUserRow,
  getUser as getUserService,
  listUsers as listUsersService,
  updateUser as updateUserService,
} from "@/services/users"
import {
  getParam,
  getVerifiedUser,
  isAdmin,
  assertControllerAccess,
  parseBody,
  parseListLimit,
  sendControllerError,
  sendData,
} from "@/lib/utils/controller"

export async function listUsers(request: Request, response: Response) {
  try {
    return sendData(response, await listUsersService(parseListLimit(request)))
  } catch (error) {
    return sendControllerError(response, error)
  }
}

export async function getCurrentUser(_request: Request, response: Response) {
  try {
    const authUser = getVerifiedUser(response)
    if (!authUser) return response.status(401).json({ error: "unauthorized" })
    const user = await getCurrentUserService(authUser)
    return user
      ? sendData(response, user)
      : response.status(404).json({ error: "user_not_found" })
  } catch (error) {
    return sendControllerError(response, error)
  }
}

export async function createUser(request: Request, response: Response) {
  try {
    assertControllerAccess(isAdmin(response))
    return sendData(
      response,
      await createUserService(parseBody(createUserSchema, request)),
      201
    )
  } catch (error) {
    return sendControllerError(response, error)
  }
}

export async function getUser(request: Request, response: Response) {
  try {
    return sendData(response, await getUserService(getParam(request, "userId")))
  } catch (error) {
    return sendControllerError(response, error)
  }
}

export async function updateUser(request: Request, response: Response) {
  try {
    const authUser = getVerifiedUser(response)
    if (!authUser) return response.status(401).json({ error: "unauthorized" })
    const currentUser = await getCurrentUserRow(authUser)
    assertControllerAccess(
      currentUser.id === getParam(request, "userId") || isAdmin(response)
    )
    return sendData(
      response,
      await updateUserService(
        getParam(request, "userId"),
        parseBody(updateUserSchema, request)
      )
    )
  } catch (error) {
    return sendControllerError(response, error)
  }
}

export async function deleteUser(request: Request, response: Response) {
  try {
    const authUser = getVerifiedUser(response)
    if (!authUser) return response.status(401).json({ error: "unauthorized" })
    const currentUser = await getCurrentUserRow(authUser)
    assertControllerAccess(
      currentUser.id === getParam(request, "userId") || isAdmin(response)
    )
    return sendData(
      response,
      await deleteUserService(getParam(request, "userId"))
    )
  } catch (error) {
    return sendControllerError(response, error)
  }
}
