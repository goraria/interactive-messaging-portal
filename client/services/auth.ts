"use client"

import { useCallback } from "react"
import axios from "@gorth/structure/cores/axios"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@gorth/primitive/cores/tanstack/query"
import { currentUserQueryKey } from "@/services/chat"
import { resolveInternalPath } from "@/lib/utils/formatter"
import type { AuthMeResponse, AuthUser } from "@/lib/utils/interface"

export const authQueryKey = ["auth", "me"] as const

async function requestMe(): Promise<AuthUser | null> {
  try {
    const response = await axios.get<AuthMeResponse>("/auth/me", {
      withCredentials: true,
    })

    if (response.status === 204) {
      return null
    }

    return response.data.user ?? null
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      return null
    }

    throw error
  }
}

async function requestLogout(returnTo: unknown = "/") {
  if (typeof window === "undefined") {
    return
  }

  await axios.delete<AuthMeResponse>("/auth/me", {
    withCredentials: true,
  })

  window.location.replace(resolveInternalPath(returnTo))
}

export async function me(): Promise<AuthUser | null> {
  try {
    return await requestMe()
  } catch {
    return null
  }
}

export function useAuthAccount() {
  const queryClient = useQueryClient()
  const query = useQuery<AuthUser | null, Error>({
    queryKey: authQueryKey,
    queryFn: requestMe,
    retry: false,
  })

  const refresh = useCallback(async () => {
    try {
      const account = await queryClient.fetchQuery({
        queryKey: authQueryKey,
        queryFn: requestMe,
        retry: false,
      })

      queryClient.setQueryData(authQueryKey, account)
      return account
    } catch {
      queryClient.setQueryData(authQueryKey, null)
      return null
    }
  }, [queryClient])

  return {
    account: query.data ?? null,
    loading: query.isLoading || query.isFetching,
    error: query.error,
    refresh,
  }
}

export function login(returnTo = "/") {
  startAuth("sign-in", returnTo)
}

export function register(returnTo = "/") {
  startAuth("sign-up", returnTo)
}

function startAuth(mode: "sign-in" | "sign-up", returnTo = "/") {
  if (typeof window === "undefined") {
    return
  }

  const url = new URL("/auth/start", window.location.origin)
  url.searchParams.set("mode", mode)
  url.searchParams.set("returnTo", resolveInternalPath(returnTo))
  window.location.assign(url.toString())
}

export function useAuthLogoutMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (returnTo?: string) => requestLogout(returnTo),
    onSuccess: () => {
      queryClient.setQueryData(authQueryKey, null)
      queryClient.removeQueries({ queryKey: currentUserQueryKey })
    },
  })
}

export async function logout(returnTo = "/") {
  await requestLogout(returnTo)
}
