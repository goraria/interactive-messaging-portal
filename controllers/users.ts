import type { Context } from "hono";
import type { ApiEnv } from "@/utils/interface";
import { createUserSchema, updateUserSchema } from "@/schemas/chat";
import {
  rawCreateUser as createUserServices,
  rawDeleteUser as deleteUserServices,
  rawGetCurrentUser as getCurrentUserServices,
  rawGetCurrentUserRow,
  rawGetUser as getUserServices,
  rawListUsers as listUsersServices,
  rawUpdateUser as updateUserServices,
} from "@/models/user";
import {
  getParam,
  getVerifiedUser,
  isAdmin,
  assertControllerAccess,
  parseBody,
  parseListLimit,
} from "@/utils/controller";
export async function actListUsers(context: Context<ApiEnv>) {
  try {
    return context.json(
      { data: await listUsersServices(parseListLimit(context)) },
      200,
    );
  } catch (error) {
    throw error;
  }
}
export async function actGetCurrentUser(context: Context<ApiEnv>) {
  try {
    const authUser = getVerifiedUser(context);
    if (!authUser) return context.json({ error: "unauthorized" }, 401);
    const user = await getCurrentUserServices(authUser);
    return user
      ? context.json({ data: user }, 200)
      : context.json({ error: "user_not_found" }, 404);
  } catch (error) {
    throw error;
  }
}
export async function actCreateUser(context: Context<ApiEnv>) {
  try {
    assertControllerAccess(isAdmin(context));
    return context.json(
      {
        data: await createUserServices(
          await parseBody(createUserSchema, context),
        ),
      },
      201,
    );
  } catch (error) {
    throw error;
  }
}
export async function actGetUser(context: Context<ApiEnv>) {
  try {
    return context.json(
      { data: await getUserServices(getParam(context, "id")) },
      200,
    );
  } catch (error) {
    throw error;
  }
}
export async function actUpdateUser(context: Context<ApiEnv>) {
  try {
    const authUser = getVerifiedUser(context);
    if (!authUser) return context.json({ error: "unauthorized" }, 401);
    const currentUser = await rawGetCurrentUserRow(authUser);
    assertControllerAccess(
      currentUser.id === getParam(context, "id") || isAdmin(context),
    );
    return context.json(
      {
        data: await updateUserServices(
          getParam(context, "id"),
          await parseBody(updateUserSchema, context),
        ),
      },
      200,
    );
  } catch (error) {
    throw error;
  }
}
export async function actDeleteUser(context: Context<ApiEnv>) {
  try {
    const authUser = getVerifiedUser(context);
    if (!authUser) return context.json({ error: "unauthorized" }, 401);
    const currentUser = await rawGetCurrentUserRow(authUser);
    assertControllerAccess(
      currentUser.id === getParam(context, "id") || isAdmin(context),
    );
    return context.json(
      { data: await deleteUserServices(getParam(context, "id")) },
      200,
    );
  } catch (error) {
    throw error;
  }
}
