import "server-only"
import { desc, eq } from "drizzle-orm"
import { getDatabase } from "@/database"
import { userTable } from "@/database/schema"
import {
  authUserSchema,
  type AuthUserInput,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/schemas/chat"
import { toUser } from "@/utils/chat"
import { createServiceError } from "@/utils/service"

export type { AuthUserInput } from "@/schemas/chat"

function fallbackEmail(externalUserId: string) {
  return `${encodeURIComponent(externalUserId)}@local.gorth.chat`
}

export async function rawFindUserByExternalId(externalUserId: string) {
  const [user] = await getDatabase()
    .select()
    .from(userTable)
    .where(eq(userTable.externalUserId, externalUserId))
    .limit(1)

  return user ?? null
}

export async function rawEnsureUser(rawUser: AuthUserInput) {
  try {
    const user = authUserSchema.parse(rawUser)
    const email = user.email ?? fallbackEmail(user.id)
    const [existing] = await getDatabase()
      .select()
      .from(userTable)
      .where(eq(userTable.externalUserId, user.id))
      .limit(1)

    if (existing) {
      const [updated] = await getDatabase()
        .update(userTable)
        .set({
          externalUserId: existing.externalUserId ?? user.id,
          name: user.name,
          username: user.username ?? existing.username,
          email,
          image: user.image === undefined ? existing.image : user.image,
          lastSeenAt: new Date(),
          syncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userTable.id, existing.id))
        .returning()

      return updated ?? existing
    }

    const [created] = await getDatabase()
      .insert(userTable)
      .values({
        externalUserId: user.id,
        name: user.name,
        username: user.username ?? null,
        email,
        image: user.image ?? null,
        status: user.status,
        lastSeenAt: new Date(),
        syncedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    if (!created) throw createServiceError(500, "user_create_failed")
    return created
  } catch (error) {
    throw error
  }
}

export async function rawGetCurrentUserRow(user: AuthUserInput) {
  try {
    const [existing] = await getDatabase()
      .select()
      .from(userTable)
      .where(eq(userTable.externalUserId, user.id))
      .limit(1)

    return existing ?? (await rawEnsureUser(user))
  } catch (error) {
    throw error
  }
}

export async function rawSyncUser(user: AuthUserInput) {
  try {
    return toUser(await rawEnsureUser(user))
  } catch (error) {
    throw error
  }
}

export async function rawGetCurrentUser(user: AuthUserInput) {
  try {
    const currentUser = await rawFindUserByExternalId(user.id)
    return currentUser ? toUser(currentUser) : null
  } catch (error) {
    throw error
  }
}

export async function rawListUsers(limit: number) {
  try {
    const rows = await getDatabase()
      .select()
      .from(userTable)
      .orderBy(desc(userTable.createdAt))
      .limit(limit)
    return rows.map(toUser)
  } catch (error) {
    throw error
  }
}

export async function rawCreateUser(input: CreateUserInput) {
  try {
    const [user] = await getDatabase()
      .insert(userTable)
      .values({
        externalUserId: input.externalUserId,
        name: input.name,
        email: input.email,
        image: input.image,
        metadata: input.metadata ?? {},
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    if (!user) throw createServiceError(500, "user_create_failed")
    return toUser(user)
  } catch (error) {
    throw error
  }
}

export async function rawGetUser(userId: string) {
  try {
    const [user] = await getDatabase()
      .select()
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1)

    if (!user) throw createServiceError(404, "user_not_found")
    return toUser(user)
  } catch (error) {
    throw error
  }
}

export async function rawUpdateUser(userId: string, input: UpdateUserInput) {
  try {
    const [user] = await getDatabase()
      .update(userTable)
      .set({
        name: input.name,
        email: input.email,
        image: input.image,
        metadata: input.metadata,
        lastSeenAt: input.lastSeenAt ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(userTable.id, userId))
      .returning()

    if (!user) throw createServiceError(404, "user_not_found")
    return toUser(user)
  } catch (error) {
    throw error
  }
}

export async function rawDeleteUser(userId: string) {
  try {
    const [user] = await getDatabase()
      .delete(userTable)
      .where(eq(userTable.id, userId))
      .returning()

    if (!user) throw createServiceError(404, "user_not_found")
    return toUser(user)
  } catch (error) {
    throw error
  }
}
