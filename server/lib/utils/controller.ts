import type { Request, Response } from "express"
import { ZodError, type ZodType } from "@gorth/structure/cores/zod"
import type { AuthContext } from "@/middlewares/auth"
import { listQuerySchema } from "@/schemas/chat"
import type { AuthUserInput } from "@/services/users"
import type { ServiceError } from "@/lib/utils/service"
import { createServiceError } from "@/lib/utils/service"

export function getParam(request: Request, name: string) {
  const value = request.params[name]
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? ""
}

export function getHeaderAuthUser(request: Request): AuthUserInput | null {
  const id = decodeURIComponent(request.get("x-gorth-user-id")?.trim() ?? "")
  const name = decodeURIComponent(
    request.get("x-gorth-user-name")?.trim() ?? ""
  )
  const email = decodeURIComponent(
    request.get("x-gorth-user-email")?.trim() ?? ""
  )

  if (!id || !name) return null
  return { id, name, email: email || undefined }
}

export function getVerifiedUser(response: Response): AuthUserInput | null {
  const auth = response.locals.auth as AuthContext | undefined
  if (!auth?.user) return null

  return {
    id: auth.user.id,
    name: auth.user.name ?? auth.user.email.split("@")[0] ?? auth.user.email,
    email: auth.user.email,
    image: auth.user.image,
  }
}

export function isAdmin(response: Response) {
  const auth = response.locals.auth as AuthContext | undefined
  const role = auth?.app?.role
  const roles = auth?.app?.roles
  const permissions = auth?.app?.permissions
  return (
    role === "admin" ||
    (Array.isArray(roles) && roles.includes("admin")) ||
    (Array.isArray(permissions) && permissions.includes("admin"))
  )
}

export function assertControllerAccess(allowed: boolean) {
  if (!allowed) throw createServiceError(403, "forbidden")
}

export function parseBody<T>(schema: ZodType<T>, request: Request) {
  return schema.parse(request.body ?? {})
}

export function parseListLimit(request: Request) {
  return listQuerySchema.parse(request.query).limit
}

export function sendData(response: Response, data: unknown, status = 200) {
  return response.status(status).json({ data })
}

export function sendControllerError(response: Response, cause: unknown) {
  if (cause instanceof ZodError) {
    return response.status(400).json({
      error: "validation_failed",
      issues: cause.issues,
    })
  }

  const serviceError = cause as Partial<ServiceError>
  if (typeof serviceError.statusCode === "number" && serviceError.code) {
    return response
      .status(serviceError.statusCode)
      .json({ error: serviceError.code })
  }

  throw cause
}
