"use client"

import { caller, createQueryService, defineQuery } from "@/utils/caller"


export interface LabResponse {
  authenticated?: boolean
  verifiedBy?: string
  user?: Record<string, unknown>
  token?: Record<string, unknown>
  app?: Record<string, unknown> | null
  error?: string
}

const labQueryKey = ["lab", "auth"] as const

export async function labAuth(): Promise<LabResponse> {
  return caller<LabResponse>({
    url: "/internal/lab/auth",
    method: "GET",
    credentials: "include",
    cache: "no-store",
    unwrapData: false,
  })
}

const labService = defineQuery<LabResponse, boolean>({
  queryKey: labQueryKey,
  query: {
    url: "/internal/lab/auth",
    method: "GET",
    credentials: "include",
    cache: "no-store",
    unwrapData: false,
  },
  queryOptions: (enabled: boolean) => ({
    enabled,
    retry: false,
    staleTime: 0,
  }),
})

const useLabQuery = createQueryService(labService)

export function useLabAuthQuery(enabled: boolean) {
  return useLabQuery(enabled)
}
