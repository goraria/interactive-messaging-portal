"use client"

import { QueryClient, useQuery } from "@gorth/primitive/cores/tanstack/query"
import { apiBaseUrl } from "@/lib/utils/environment"

export interface LabResponse {
  authenticated?: boolean
  verifiedBy?: string
  user?: Record<string, unknown>
  token?: Record<string, unknown>
  app?: Record<string, unknown> | null
  error?: string
}

const queryClient = new QueryClient()
const labQueryKey = ["lab", "auth"] as const

export async function labAuth(): Promise<LabResponse> {
  const response = await fetch(`${apiBaseUrl ?? "http://localhost:5050"}/lab`, {
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store",
  })
  const payload = (await response.json().catch(() => null)) as LabResponse | null

  if (!response.ok) {
    const error = new Error(payload?.error ?? "Lab verification failed") as Error & {
      status?: number
      payload?: LabResponse | null
    }
    error.status = response.status
    error.payload = payload
    throw error
  }

  return payload ?? { error: "empty_lab_response" }
}

export function useLabAuthQuery(enabled: boolean) {
  return useQuery<LabResponse, Error>(
    {
      queryKey: labQueryKey,
      queryFn: labAuth,
      enabled,
      retry: false,
      staleTime: 0,
    },
    queryClient,
  )
}
