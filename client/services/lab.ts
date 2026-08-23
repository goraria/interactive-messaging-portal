"use client"

import { caller, createQueryService, useQuery } from "@/lib/utils/caller"

/* eslint-disable react-hooks/rules-of-hooks -- useQuery builds a service definition here. */

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
    url: "/lab",
    method: "GET",
    credentials: "include",
    cache: "no-store",
    unwrapData: false,
  })
}

const labService = useQuery<LabResponse, boolean>({
  queryKey: labQueryKey,
  query: {
    url: "/lab",
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
