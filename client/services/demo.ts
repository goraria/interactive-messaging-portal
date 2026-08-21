"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type {
  DemoApiData,
  DemoApiError,
  DemoApiRequest,
  DemoApiResult,
  EndpointApiResponseEnvelope,
} from "@/lib/utils/interface"

async function requestDemo(arg: DemoApiRequest = {}): Promise<DemoApiResult> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), arg.timeout ?? 10000)
  const url = new URL("/demo/call", window.location.origin)

  Object.entries(arg.params ?? {}).forEach(([key, value]) => {
    if (value !== undefined) url.searchParams.set(key, String(value))
  })

  try {
    const response = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...arg.headers },
      body: JSON.stringify(arg.body ?? arg.data ?? null),
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => null) as
      | EndpointApiResponseEnvelope<DemoApiData>
      | { error?: string }
      | null

    if (!response.ok) {
      return {
        error: {
          status: response.status,
          error: payload && "error" in payload ? payload.error : response.statusText,
          data: payload,
        },
      }
    }

    return { data: payload && "data" in payload ? payload.data : undefined }
  } catch (cause) {
    const error: DemoApiError = {
      status: "FETCH_ERROR",
      error: cause instanceof Error ? cause.message : "Request failed",
    }
    return { error }
  } finally {
    window.clearTimeout(timeout)
  }
}

export function demoJson(initialArg: DemoApiRequest = {}) {
  const initialArgRef = useRef(initialArg)
  const [data, setData] = useState<DemoApiData | null>(null)
  const [error, setError] = useState<DemoApiError | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async (arg: DemoApiRequest = initialArgRef.current) => {
    setLoading(true)
    setError(null)
    const result = await requestDemo(arg)
    setData(result.data ?? null)
    setError(result.error ?? null)
    setLoading(false)
    return result
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { data, error, loading, refresh }
}

export const demoJsonRequest = requestDemo
