import type { Context } from "hono"
import type { ApiEnv } from "@/utils/interface"
import { createUserSchema, updateUserSchema } from "@/schemas/chat"
import {
  createUser as createUserServices,
  deleteUser as deleteUserServices,
  getCurrentUser as getCurrentUserServices,
  getCurrentUserRow,
  getUser as getUserServices,
  listUsers as listUsersServices,
  updateUser as updateUserServices,
} from "@/services/users"
import {
  getParam,
  getVerifiedUser,
  isAdmin,
  assertControllerAccess,
  parseBody,
  parseListLimit,
} from "@/utils/controller"
export async function listUsers(context: Context<ApiEnv>) {
  try {
    return context.json(
      { data: await listUsersServices(parseListLimit(context)) },
      200
    )
  } catch (error) {
    throw error
  }
}
export async function getCurrentUser(context: Context<ApiEnv>) {
  try {
    const authUser = getVerifiedUser(context)
    if (!authUser) return context.json({ error: "unauthorized" }, 401)
    const user = await getCurrentUserServices(authUser)
    return user
      ? context.json({ data: user }, 200)
      : context.json({ error: "user_not_found" }, 404)
  } catch (error) {
    throw error
  }
}
export async function createUser(context: Context<ApiEnv>) {
  try {
    assertControllerAccess(isAdmin(context))
    return context.json(
      {
        data: await createUserServices(
          await parseBody(createUserSchema, context)
        ),
      },
      201
    )
  } catch (error) {
    throw error
  }
}
export async function getUser(context: Context<ApiEnv>) {
  try {
    return context.json(
      { data: await getUserServices(getParam(context, "userId")) },
      200
    )
  } catch (error) {
    throw error
  }
}
export async function updateUser(context: Context<ApiEnv>) {
  try {
    const authUser = getVerifiedUser(context)
    if (!authUser) return context.json({ error: "unauthorized" }, 401)
    const currentUser = await getCurrentUserRow(authUser)
    assertControllerAccess(
      currentUser.id === getParam(context, "userId") || isAdmin(context)
    )
    return context.json(
      {
        data: await updateUserServices(
          getParam(context, "userId"),
          await parseBody(updateUserSchema, context)
        ),
      },
      200
    )
  } catch (error) {
    throw error
  }
}
export async function deleteUser(context: Context<ApiEnv>) {
  try {
    const authUser = getVerifiedUser(context)
    if (!authUser) return context.json({ error: "unauthorized" }, 401)
    const currentUser = await getCurrentUserRow(authUser)
    assertControllerAccess(
      currentUser.id === getParam(context, "userId") || isAdmin(context)
    )
    return context.json(
      { data: await deleteUserServices(getParam(context, "userId")) },
      200
    )
  } catch (error) {
    throw error
  }
}
