export const authUserStatuses = [
  "active",
  "inactive",
  "suspended",
  "deleted",
] as const

export type AuthUserStatus = (typeof authUserStatuses)[number]

export interface SsoAuthUserClaims extends Record<string, unknown> {
  sub?: string
  email?: string
  name?: string | null
  preferred_username?: string | null
  status?: AuthUserStatus
  picture?: string | null
  user_metadata?: Record<string, unknown>
  gorth_app?: Record<string, unknown>
}

export interface SsoAuthUser {
  id: string
  email: string
  name: string | null
  username: string | null
  image: string | null
  status: AuthUserStatus
}

export interface TimestampedUser {
  lastSeenAt?: Date | null
  syncedAt: Date
  createdAt: Date
  updatedAt: Date
}

export function normalizeUrl(value: string) {
  return new URL(value).toString().replace(/\/$/, "")
}

export function getRecordString(
  record: Record<string, unknown> | undefined,
  key: string
) {
  const value = record?.[key]
  return typeof value === "string" ? value : null
}

export function getAuthUserStatus(value: unknown): AuthUserStatus {
  return authUserStatuses.includes(value as AuthUserStatus)
    ? (value as AuthUserStatus)
    : "active"
}

export function formatSsoAuthUser(
  payload: SsoAuthUserClaims
): SsoAuthUser | null {
  if (!payload.sub || !payload.email) return null

  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name ?? getRecordString(payload.user_metadata, "name"),
    username:
      payload.preferred_username ??
      getRecordString(payload.user_metadata, "username"),
    image:
      payload.picture ??
      getRecordString(payload.user_metadata, "avatar_url") ??
      getRecordString(payload.user_metadata, "picture"),
    status: getAuthUserStatus(payload.status),
  }
}

export function getAppClaim(payload: SsoAuthUserClaims, claimName: string) {
  const claim = payload[claimName]

  if (claim && typeof claim === "object") {
    return claim as Record<string, unknown>
  }

  return payload.gorth_app ?? null
}

export function formatUser<T extends TimestampedUser>(user: T) {
  return {
    ...user,
    lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
    syncedAt: user.syncedAt.toISOString(),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}

export function formatPublicSession(record: {
  subject: string
  expiresAt: number
  user: {
    name: string
    email: string
    username: string | null
    image: string | null
  }
}) {
  const { name, email, username, image } = record.user
  return {
    user: { id: record.subject, name, email, username, image },
    expiresAt: record.expiresAt,
  }
}

// Raw execute() results do not use Drizzle's column date decoders.
export function formatChatTimestamp(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value !== "string") throw new TypeError("Invalid Chat timestamp")
  const normalized = /[zZ]$|[+-]\d{2}(?::?\d{2})?$/.test(value)
    ? value
    : value.replace(" ", "T") + "Z"
  return new Date(normalized).toISOString()
}
export function formatChatConversation<T extends Record<string, unknown>>(
  row: T
) {
  return {
    ...row,
    createdAt: formatChatTimestamp(row.createdAt),
    updatedAt: formatChatTimestamp(row.updatedAt),
    archivedAt: formatChatTimestamp(row.archivedAt),
    mutedUntil: formatChatTimestamp(row.mutedUntil),
  }
}

const internalApiDomains = new Set([
  "user",
  "conversation",
  "message",
  "attachment",
  "block",
  "call",
  "event",
  "lab",
  "hello",
  "param",
  "query",
  "health",
])

const externalApiDomains = new Set([
  "billing",
  "discovery",
  "insight",
  "media",
  "notification",
  "payment",
  "resource",
  "commerce",
  "socket",
])

// Canonicalize dynamic same-origin query and mutation paths.
export function formatApiPath(path: string) {
  const domain = /^\/([a-z-]+)(?:[/?#]|$)/.exec(path)?.[1]
  if (!domain) return path
  if (internalApiDomains.has(domain)) return "/internal" + path
  if (externalApiDomains.has(domain)) return "/external" + path
  return path
}
