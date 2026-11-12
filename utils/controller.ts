import type { Context } from "hono"
import type { ZodType } from "@gorth-io/structure/cores/zod"
import type { ApiEnv } from "@/utils/interface"
import { listQuerySchema } from "@/schemas/chat"
import type { AuthUserInput } from "@/services/users"
import { createServiceError } from "@/utils/service"

export function getParam(context: Context<ApiEnv>, name: string) {
  return context.req.param(name)?.trim() ?? ""
}

export function getVerifiedUser(
  context: Context<ApiEnv>
): AuthUserInput | null {
  const auth = context.get("auth")
  if (!auth?.user) return null
  return {
    id: auth.user.id,
    name: auth.user.name ?? auth.user.email.split("@")[0] ?? auth.user.email,
    email: auth.user.email,
    image: auth.user.image,
    status: auth.user.status,
  }
}

export function isAdmin(context: Context<ApiEnv>) {
  return context.get("auth")?.localRole === "admin"
}

export function assertControllerAccess(allowed: boolean) {
  if (!allowed) throw createServiceError(403, "forbidden")
}

export async function parseBody<T>(
  schema: ZodType<T>,
  context: Context<ApiEnv>
) {
  if (
    context.req.header("content-type")?.split(";", 1)[0]?.trim() !==
    "application/json"
  )
    throw createServiceError(415, "unsupported_media_type")
  let input: unknown
  try {
    input = await context.req.json()
  } catch {
    throw createServiceError(400, "invalid_json")
  }
  return schema.parse(input)
}

export function parseListLimit(context: Context<ApiEnv>) {
  return listQuerySchema.parse(context.req.query()).limit
}
