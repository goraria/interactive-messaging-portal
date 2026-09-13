import { desc, eq, or } from "drizzle-orm"
import { database } from "@/database"
import { usersTable } from "@/database/schema"
import {
  authUserSchema,
  type AuthUserInput,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/schemas/chat"
import { toUser } from "@/lib/utils/chat"
import { createServiceError } from "@/lib/utils/service"

export type { AuthUserInput } from "@/schemas/chat"

function fallbackEmail(externalUserId: string) {
  return `${encodeURIComponent(externalUserId)}@local.gorth.chat`
}

export async function findUserByExternalId(externalUserId: string) {
  const [user] = await database
    .select()
    .from(usersTable)
    .where(eq(usersTable.externalUserId, externalUserId))
    .limit(1)

  return user ?? null
}

export async function ensureUser(rawUser: AuthUserInput) {
  try {
    const user = authUserSchema.parse(rawUser)
    const email = user.email ?? fallbackEmail(user.id)
    const [existing] = await database
      .select()
      .from(usersTable)
      .where(
        user.email
          ? or(
              eq(usersTable.externalUserId, user.id),
              eq(usersTable.email, email)
            )
          : eq(usersTable.externalUserId, user.id)
      )
      .limit(1)

    if (existing) {
      const [updated] = await database
        .update(usersTable)
        .set({
          externalUserId: existing.externalUserId ?? user.id,
          name: user.name,
          username: user.username ?? existing.username,
          email,
          image: user.image === undefined ? existing.image : user.image,
          status: user.status,
          lastSeenAt: new Date(),
          syncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, existing.id))
        .returning()

      return updated ?? existing
    }

    const [created] = await database
      .insert(usersTable)
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

export async function getCurrentUserRow(user: AuthUserInput) {
  try {
    const [existing] = await database
      .select()
      .from(usersTable)
      .where(eq(usersTable.externalUserId, user.id))
      .limit(1)

    return existing ?? (await ensureUser(user))
  } catch (error) {
    throw error
  }
}

export async function syncUser(user: AuthUserInput) {
  try {
    return toUser(await ensureUser(user))
  } catch (error) {
    throw error
  }
}

export async function getCurrentUser(user: AuthUserInput) {
  try {
    const currentUser = await findUserByExternalId(user.id)
    return currentUser ? toUser(currentUser) : null
  } catch (error) {
    throw error
  }
}

export async function listUsers(limit: number) {
  try {
    const rows = await database
      .select()
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt))
      .limit(limit)
    return rows.map(toUser)
  } catch (error) {
    throw error
  }
}

export async function createUser(input: CreateUserInput) {
  try {
    const [user] = await database
      .insert(usersTable)
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

export async function getUser(userId: string) {
  try {
    const [user] = await database
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)

    if (!user) throw createServiceError(404, "user_not_found")
    return toUser(user)
  } catch (error) {
    throw error
  }
}

export async function updateUser(userId: string, input: UpdateUserInput) {
  try {
    const [user] = await database
      .update(usersTable)
      .set({
        externalUserId: input.externalUserId,
        name: input.name,
        email: input.email,
        image: input.image,
        metadata: input.metadata,
        lastSeenAt: input.lastSeenAt ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, userId))
      .returning()

    if (!user) throw createServiceError(404, "user_not_found")
    return toUser(user)
  } catch (error) {
    throw error
  }
}

export async function deleteUser(userId: string) {
  try {
    const [user] = await database
      .delete(usersTable)
      .where(eq(usersTable.id, userId))
      .returning()

    if (!user) throw createServiceError(404, "user_not_found")
    return toUser(user)
  } catch (error) {
    throw error
  }
}
