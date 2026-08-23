"use client"

import { useCallback } from "react"
import type { AxiosResponse } from "axios"

import {
  caller,
  createMutationService,
  createQueryService,
  useMutation,
  useQuery,
} from "@/lib/utils/caller"
import { resolveInternalPath } from "@/lib/utils/formatter"
import type { AuthMeResponse, AuthUser } from "@/lib/utils/interface"

/* eslint-disable react-hooks/rules-of-hooks -- useQuery/useMutation build service definitions here. */

export const authQueryKey = ["auth", "me"] as const

function getAccountRequest() {
  return {
    baseURL: null,
    url: "/auth/me",
    method: "GET" as const,
    auth: false,
    credentials: "include" as const,
    unwrapData: false,
    validateStatus: (status: number) =>
      (status >= 200 && status < 300) || status === 401,
    responseHandler: (response: AxiosResponse<unknown>) => {
      const payload = response.data as AuthMeResponse

      return response.status === 204 || response.status === 401
        ? null
        : (payload.user ?? null)
    },
  }
}

function getLogoutRequest() {
  return {
    baseURL: null,
    url: "/auth/me",
    method: "DELETE" as const,
    auth: false,
    credentials: "include" as const,
    unwrapData: false,
    responseHandler: (response: AxiosResponse<unknown>) =>
      response.data as AuthMeResponse,
  }
}

const accountService = useQuery<AuthUser | null, undefined>({
  queryKey: authQueryKey,
  query: getAccountRequest,
  queryOptions: {
    retry: false,
  },
})

const logoutService = useMutation<AuthMeResponse, string | undefined>({
  query: () => getLogoutRequest(),
  invalidates: [authQueryKey],
})

const useAccountQuery = createQueryService(accountService)
const useLogoutMutation = createMutationService(logoutService)

async function requestMe(): Promise<AuthUser | null> {
  return caller<AuthUser | null>(getAccountRequest())
}

async function requestLogout(returnTo: unknown = "/") {
  if (typeof window === "undefined") return

  try {
    const response = await caller<AuthMeResponse>(getLogoutRequest())

    window.location.replace(
      response.logout_url ?? resolveInternalPath(returnTo)
    )
  } catch {
    window.location.replace(resolveInternalPath(returnTo))
  }
}

export async function me(): Promise<AuthUser | null> {
  try {
    return await requestMe()
  } catch {
    return null
  }
}

export function useAuthAccount() {
  const query = useAccountQuery(undefined)
  const { refetch } = query

  const refresh = useCallback(async () => {
    const result = await refetch()
    return result.data ?? null
  }, [refetch])

  return {
    account: query.data ?? null,
    loading: query.isLoading || query.isFetching,
    error: query.error,
    refresh,
  }
}

function startAuth(mode: "sign-in" | "sign-up", returnTo: unknown = "/") {
  if (typeof window === "undefined") return

  const url = new URL("/auth/start", window.location.origin)
  url.searchParams.set("mode", mode)
  url.searchParams.set("returnTo", resolveInternalPath(returnTo))
  window.location.assign(url.toString())
}

export function login(returnTo: unknown = "/") {
  startAuth("sign-in", returnTo)
}

export function register(returnTo: unknown = "/") {
  startAuth("sign-up", returnTo)
}

export function useAuthLogoutMutation() {
  const [trigger, state] = useLogoutMutation()

  const logout = useCallback(
    (returnTo?: string) => {
      const promise = trigger(returnTo)
        .unwrap()
        .then((response) => {
          if (typeof window !== "undefined") {
            window.location.replace(
              response.logout_url ?? resolveInternalPath(returnTo)
            )
          }

          return response
        })
        .catch((error) => {
          if (typeof window !== "undefined") {
            window.location.replace(resolveInternalPath(returnTo))
          }

          throw error
        })

      return {
        unwrap: () => promise,
      }
    },
    [trigger]
  )

  return [logout, state] as const
}

export async function logout(returnTo = "/") {
  await requestLogout(returnTo)
}
