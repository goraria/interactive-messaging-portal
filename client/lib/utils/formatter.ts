import type {
  ApiErrorPayload,
  CallerMethod,
  CallerToastConfig,
  EndpointFetchArgs,
} from "@/lib/utils/interface"

import { clientUrl } from "@/lib/utils/environment"
import type { AuthUser, SsoExchangeResponse } from "@/lib/utils/interface"
import { toast } from "@gorth/primitive/custom/toast"

export function parseJsonInput(
  value: string,
  options: { label: string; objectOnly: true }
): Record<string, unknown> | null | undefined
export function parseJsonInput(
  value: string,
  options: { label: string; objectOnly?: false }
): unknown | null | undefined
export function parseJsonInput(
  value: string,
  { label, objectOnly = false }: { label: string; objectOnly?: boolean }
) {
  const text = value.trim()
  if (!text) return undefined

  try {
    const parsed = JSON.parse(text)
    if (
      objectOnly &&
      (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    ) {
      toast.add({ type: "error", description: label + " must be a valid JSON object" })
      return null
    }
    return parsed
  } catch {
    toast.add({ type: "error", description: label + " is not valid JSON" })
    return null
  }
}

export function getSsoUser(payload: unknown): AuthUser | null {
  const data = payload as SsoExchangeResponse

  if (
    !data.user ||
    typeof data.user.id !== "string" ||
    typeof data.user.email !== "string"
  ) {
    return null
  }

  return {
    id: data.user.id,
    email: data.user.email,
    name: typeof data.user.name === "string" ? data.user.name : data.user.email,
    username:
      typeof data.user.username === "string" ? data.user.username : null,
    image: typeof data.user.image === "string" ? data.user.image : null,
  }
}

export function getInitials(value: string, limit = 2) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, limit)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
}

export function getValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export function readRouteId(value: string | string[] | undefined) {
  const id = getValue(value)

  return id ? decodeURIComponent(id) : ""
}

export function formatConversationDate(value: string | Date) {
  const date = new Date(value)
  const today = new Date()

  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date)
}

export function formatMessageTime(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value))
}

export function getAccountDisplayName(user: AuthUser) {
  return user.name || user.email
}

export function resolveToastMessage(
  config: CallerToastConfig | undefined,
  kind: "loading" | "success" | "error",
  fallback?: string
) {
  if (!config) return null
  return config === true
    ? (fallback ?? null)
    : (config[kind] ?? fallback ?? null)
}

export function getPayloadMessage(payload: unknown) {
  if (typeof payload === "string") return payload
  if (!payload || typeof payload !== "object") return null
  const data = payload as ApiErrorPayload
  if (Array.isArray(data.errors)) {
    const messages = data.errors.flatMap((item) => {
      if (!item || typeof item !== "object" || !("message" in item)) return []
      return typeof item.message === "string" ? [item.message] : []
    })
    if (messages.length) return messages.join(", ")
  }
  if (typeof data.message === "string") return data.message
  return typeof data.error === "string" ? data.error : null
}

export function getStatusMessage(status: number | undefined) {
  if (status === 401) return "Your session has expired"
  if (status === 403) return "You do not have permission to perform this action"
  if (status === 404) return "Data not found"
  if (status === 500) return "Internal server error"
  return status ? "Error " + status : "Request failed"
}

export function isMutation(
  method: CallerMethod,
  endpointType?: "query" | "mutation"
) {
  return endpointType ? endpointType === "mutation" : method !== "GET"
}

export function isAbsoluteUrl(url: string) {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

export function isInternalRoute(url: string) {
  return url.startsWith("/auth/") || url.startsWith("/demo/")
}

export function unwrapResponseData<T>(payload: unknown, unwrap: boolean) {
  if (!unwrap) return payload as T
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data
  }
  return payload as T
}

export function getEndpointRequest(
  args: string | EndpointFetchArgs
): EndpointFetchArgs {
  return typeof args === "string" ? { url: args, method: "GET" } : args
}

export function getEndpointRequestMethod(
  args: string | EndpointFetchArgs
): CallerMethod {
  return typeof args === "string" ? "GET" : (args.method ?? "GET")
}

export function getEndpointRequestBody(request: EndpointFetchArgs) {
  return request.data ?? request.body
}

function getStableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(getStableValue)
  if (!value || typeof value !== "object") return value
  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = getStableValue((value as Record<string, unknown>)[key])
      return result
    }, {})
}

export function getEndpointArgKey(arg: unknown) {
  try {
    return JSON.stringify(getStableValue(arg)) ?? "undefined"
  } catch {
    return String(arg)
  }
}

export function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

const clientOrigin = normalizeOrigin(clientUrl)

export const resolveRedirect = (value: string | null) => {
  if (!value) {
    return null
  }

  try {
    const target = new URL(value)
    if (!["http:", "https:"].includes(target.protocol)) {
      return null
    }

    if (!clientOrigin || target.origin !== clientOrigin) {
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
  const origin = request.headers.get("origin")

  if (!origin || !clientOrigin || normalizeOrigin(origin) !== clientOrigin) {
    return {}
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  }
}

export function isAbsoluteHttpUrl(value: string | null) {
  if (!value) {
    return false
  }

  try {
    const target = new URL(value)
    return ["http:", "https:"].includes(target.protocol)
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
  mode: "headers"
): Record<string, string> | undefined
export function normalizeRequestRecord(
  record: Record<string, unknown> | undefined,
  mode: "params"
): Record<string, string | number | boolean | null | undefined> | undefined
export function normalizeRequestRecord(
  record: Record<string, unknown> | undefined,
  mode: "headers" | "params"
) {
  if (!record) return undefined

  return Object.entries(record).reduce<
    Record<string, string | number | boolean | null | undefined>
  >((result, [key, value]) => {
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
  }, {})
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
