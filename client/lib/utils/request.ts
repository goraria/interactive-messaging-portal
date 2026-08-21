import axios from "@gorth/structure/cores/axios"
import { toast } from "@gorth/primitive/cores/sonner"
import { apiBaseUrl } from "@/lib/utils/environment"
import {
  getPayloadMessage,
  getStatusMessage,
  isAbsoluteUrl,
  isInternalRoute,
  resolveToastMessage,
} from "@/lib/utils/formatter"
import type {
  CallerConfig,
  CallerToastConfig,
  EndpointFetchBaseQueryError,
  EndpointQueryReturnValue,
} from "@/lib/utils/interface"

export interface AxiosCallerConfig<TData = unknown> extends CallerConfig<TData> {
  signal?: AbortSignal
}

const SILENT_ERROR_ENDPOINTS = ["/auth/register", "/auth/me"]

interface EndpointErrorLike {
  status: number | "FETCH_ERROR"
  data?: unknown
  error?: string
}

function isEndpointError(error: unknown): error is EndpointErrorLike {
  return Boolean(
    error &&
      typeof error === "object" &&
      "status" in error &&
      ("error" in error || "data" in error)
  )
}

export function resolveReturnTo(returnTo = "/") {
  if (typeof window === "undefined") {
    return returnTo
  }

  try {
    return new URL(returnTo, window.location.origin).toString()
  } catch {
    return window.location.origin
  }
}

export function redirectToSso(path: string, returnTo = "/") {
  if (typeof window === "undefined") {
    return
  }

  const url = new URL(path)
  url.searchParams.set("redirect", resolveReturnTo(returnTo))
  window.location.assign(url.toString())
}

export function getErrorMessage(error: unknown) {
  if (isEndpointError(error)) {
    return getPayloadMessage(error.data) ?? error.error ?? String(error.status)
  }

  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : "Request failed"
  }

  const payloadMessage = getPayloadMessage(error.response?.data)

  if (payloadMessage) {
    return payloadMessage
  }

  if (error.response?.status) {
    return getStatusMessage(error.response.status)
  }

  return error.message
}

export function resolveBaseURL(url: string, baseURL: string | null | undefined) {
  if (baseURL === null || isAbsoluteUrl(url) || isInternalRoute(url)) {
    return undefined
  }

  return baseURL ?? apiBaseUrl
}

export function isFormData(data: unknown) {
  return typeof FormData !== "undefined" && data instanceof FormData
}

export function hasHeader(headers: Record<string, string>, name: string) {
  const target = name.toLowerCase()
  return Object.keys(headers).some((key) => key.toLowerCase() === target)
}

export function shouldShowErrorToast(
  url: string,
  status: number | undefined,
  toastConfig: CallerToastConfig | undefined
) {
  if (!toastConfig || (status !== undefined && status < 400)) {
    return false
  }

  if (status === 401 && url.includes("/auth/me")) {
    return false
  }

  return !SILENT_ERROR_ENDPOINTS.some((endpoint) => url.includes(endpoint))
}

export async function getSupabaseSessionToken() {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const { createClient } = await import("@/lib/supabase/client")
    const client = createClient()
    if (!client) return null

    const {
      data: { session },
    } = await client.auth.getSession()

    if (session?.access_token) {
      return session.access_token
    }
  } catch {
  }

  try {
    const supabaseAuthKey = Object.keys(localStorage).find(
      (key) => key.includes("auth-token") && key.startsWith("sb-")
    )

    if (supabaseAuthKey) {
      const sessionData = localStorage.getItem(supabaseAuthKey)
      const session = sessionData ? JSON.parse(sessionData) : null

      if (typeof session?.access_token === "string") {
        return session.access_token
      }
    }
  } catch {
  }

  try {
    const supabaseCookie = document.cookie
      .split("; ")
      .find((row) => row.includes("-auth-token"))

    if (supabaseCookie) {
      const cookieValue = supabaseCookie.split("=")[1]
      const parsed = cookieValue ? JSON.parse(decodeURIComponent(cookieValue)) : null

      if (typeof parsed?.access_token === "string") {
        return parsed.access_token
      }
    }
  } catch {
  }

  return null
}

export async function prepareHeaders(
  headers: Record<string, string> | undefined,
  data: unknown,
  auth: boolean
) {
  const nextHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  }

  if (!isFormData(data) && !hasHeader(nextHeaders, "Content-Type")) {
    nextHeaders["Content-Type"] = "application/json"
  }

  if (auth && !hasHeader(nextHeaders, "Authorization")) {
    const token = await getSupabaseSessionToken()

    if (token) {
      nextHeaders.Authorization = "Bearer " + token
    }
  }

  return nextHeaders
}

export async function requestWithAxios<TData = unknown>({
  url,
  method = "GET",
  data,
  params,
  headers,
  timeout,
  withCredentials = true,
  auth = true,
  baseURL,
  signal,
}: AxiosCallerConfig<TData>) {
  return axios.request({
    baseURL: resolveBaseURL(url, baseURL),
    url,
    method,
    data,
    params,
    headers: await prepareHeaders(headers, data, auth),
    timeout,
    withCredentials,
    signal,
  })
}

export function getEndpointErrorResponse(
  error: unknown
): EndpointQueryReturnValue<never, EndpointFetchBaseQueryError> {
  if (axios.isAxiosError(error)) {
    return {
      error: {
        status: error.response?.status ?? "FETCH_ERROR",
        data: error.response?.data,
        error: error.message,
      },
      meta: {
        response: {
          status: error.response?.status ?? 0,
        },
      },
    }
  }

  return {
    error: {
      status: "FETCH_ERROR",
      error: error instanceof Error ? error.message : "Unknown error",
    },
  }
}

export function getToast() {
  if (typeof window === "undefined") {
    return null
  }

  return toast
}

export function notify(
  toastConfig: CallerToastConfig | undefined,
  kind: "success" | "error",
  message: string | null
) {
  if (!message || !toastConfig) {
    return
  }

  const toastApi = getToast()
  toastApi?.[kind](message)
}

export function startLoadingToast(toastConfig: CallerToastConfig | undefined) {
  const message = resolveToastMessage(toastConfig, "loading")

  if (!message) {
    return null
  }

  const toastApi = getToast()
  return toastApi?.loading(message) ?? null
}

export function dismissToast(id: string | number | null) {
  if (!id) {
    return
  }

  const toastApi = getToast()
  toastApi?.dismiss(id)
}

export {
  getEndpointArgKey,
  getEndpointRequest,
  getEndpointRequestBody,
  getEndpointRequestMethod,
  getPayloadMessage,
  getStatusMessage,
  isMutation,
  resolveToastMessage,
  unwrapResponseData,
} from "@/lib/utils/formatter"
