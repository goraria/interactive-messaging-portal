import type {
  ApiErrorPayload,
  CallerMethod,
  CallerToastConfig,
  EndpointFetchArgs,
} from "@/lib/utils/interface"

export * from "@/lib/formatter"

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

export function getAccountDisplayName(
  name: string | null | undefined,
  email: string | null | undefined,
  metadata: Record<string, unknown> = {}
) {
  return name ?? String(metadata.full_name ?? metadata.name ?? email ?? "Guest")
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
