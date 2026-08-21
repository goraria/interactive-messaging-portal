import { redirectUrl } from "@/lib/environment"
import { NextResponse } from "next/server"
import type { AuthUser, SsoExchangeResponse, SsoUser } from "@/lib/utils/interface"

const allowedRedirectOrigins = redirectUrl ?? ""

type BetterAuthUser = {
  id: string
  email: string
  name: string
  image?: string | null
  emailVerified?: boolean
  updatedAt?: Date | string | null
  createdAt?: Date | string | null
}

export function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

export const getAllowedOrigins = () =>
  allowedRedirectOrigins
    .split(',')
    .map((origin) => normalizeOrigin(origin.trim()))
    .filter((origin): origin is string => Boolean(origin))

export const resolveRedirect = (value: string | null) => {
  if (!value) {
    return null
  }

  try {
    const target = new URL(value)
    if (!['http:', 'https:'].includes(target.protocol)) {
      return null
    }

    if (!getAllowedOrigins().includes(target.origin)) {
      return null
    }

    return target.toString()
  } catch {
    return null
  }
}

export function getRedirectValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export function getCorsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('origin')

  if (!origin || !getAllowedOrigins().includes(origin)) {
    return {}
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  }
}

export function isAbsoluteHttpUrl(value: string | null) {
  if (!value) {
    return false
  }

  try {
    const target = new URL(value)
    return ['http:', 'https:'].includes(target.protocol)
  } catch {
    return false
  }
}

export function resolveInternalPath(value: unknown) {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//")
    ? value
    : "/"
}

export function stringifyJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

export function normalizeRequestRecord(
  record: Record<string, unknown> | undefined,
  mode: "headers",
): Record<string, string> | undefined
export function normalizeRequestRecord(
  record: Record<string, unknown> | undefined,
  mode: "params",
): Record<string, string | number | boolean | null | undefined> | undefined
export function normalizeRequestRecord(
  record: Record<string, unknown> | undefined,
  mode: "headers" | "params",
) {
  if (!record) return undefined

  return Object.entries(record).reduce<Record<string, string | number | boolean | null | undefined>>(
    (result, [key, value]) => {
      if (mode === "headers") {
        if (value !== undefined && value !== null) result[key] = String(value)
      } else if (typeof value === "object" && value !== null) {
        result[key] = JSON.stringify(value)
      } else if (
        value === undefined ||
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        result[key] = value
      }

      return result
    },
    {},
  )
}

export function getSsoUser(payload: unknown): AuthUser | null {
  const data = payload as SsoExchangeResponse

  if (!data.user || typeof data.user.id !== "string" || typeof data.user.email !== "string") {
    return null
  }

  return data.user
}

export function buildAppExchangeCodeUrl(redirect: string, code: string) {
  const target = new URL(redirect)
  const state = target.searchParams.get("auth_state")

  target.searchParams.delete("auth_state")

  const next = `${target.pathname}${target.search}${target.hash}` || "/"

  target.pathname = "/auth/exchange"
  target.search = ""
  target.hash = ""
  target.searchParams.set("code", code)
  target.searchParams.set("next", next)

  if (state) {
    target.searchParams.set("state", state)
  }

  return target.toString()
}

function toIsoString(value: Date | string | null | undefined) {
  if (value instanceof Date) {
    return value.toISOString()
  }

  return typeof value === "string" ? value : null
}

export function toSsoUser(user: BetterAuthUser): SsoUser {
  const updatedAt = toIsoString(user.updatedAt)
  const createdAt = toIsoString(user.createdAt)
  const emailVerifiedAt =
    user.emailVerified ? updatedAt ?? createdAt : null

  return {
    id: user.id,
    aud: "authenticated",
    email: user.email,
    email_confirmed_at: emailVerifiedAt,
    confirmed_at: emailVerifiedAt,
    phone: null,
    role: "authenticated",
    updated_at: updatedAt,
    created_at: createdAt,
    app_metadata: {
      provider: "better-auth",
    },
    user_metadata: {
      name: user.name,
      full_name: user.name,
      avatar_url: user.image ?? null,
      picture: user.image ?? null,
    },
  }
}

export function buildUserResponse(user: SsoUser) {
  return NextResponse.json({
    user,
    sso_sub: user.id,
    email: user.email,
  })
}
