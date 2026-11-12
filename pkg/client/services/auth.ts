"use client"

import { useCallback, useSyncExternalStore } from "react"
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@gorth/primitive/cores/tanstack/query"
import { AuthError } from "@gorth/structure/modules/auth/client"
import { authClient } from "@/lib/auth/browser"
import { resolveInternalPath } from "@/utils/formatter"
import type { AuthMeResponse, AuthUser } from "@/utils/interface"

export const authQueryKey = ["auth", "me"] as const

export async function me(): Promise<AuthUser | null> {
  return (await authClient.load())?.user ?? null
}

export function useAuthAccount() {
  const state = useSyncExternalStore(
    authClient.subscribe,
    authClient.getSnapshot,
    authClient.getSnapshot
  )
  const query = useQuery({
    queryKey: authQueryKey,
    queryFn: me,
    retry: false,
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
  const { refetch } = query
  const refresh = useCallback(async () => {
    const result = await refetch()
    return result.data ?? null
  }, [refetch])
  return {
    account: query.data ?? null,
    loading: query.isLoading || state.busy,
    error: query.error ?? (state.error ? new AuthError(state.error) : null),
    refresh,
  }
}

export async function login(returnTo: unknown = "/") {
  if (typeof window === "undefined") return
  try {
    await authClient.login({ returnTo: resolveInternalPath(returnTo) })
  } catch {
    // Structure publishes the sanitized failure consumed by useAuthAccount.
  }
}
export async function register(returnTo: unknown = "/") {
  if (typeof window === "undefined") return
  try {
    await authClient.login({
      returnTo: resolveInternalPath(returnTo),
      prompt: "create",
    })
  } catch {
    // Account creation uses the same public state and navigation contract.
  }
}
export async function logout(_returnTo = "/") {
  // Sign out only this app; the central SSO session remains signed in.
  void _returnTo
  await authClient.logout()
}

export function useAuthLogoutMutation() {
  const queryClient = useQueryClient()
  const mutation = useMutation<AuthMeResponse, Error, string | undefined>({
    mutationFn: async () => {
      await authClient.logout()
      return { user: null }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: authQueryKey })
      queryClient.setQueryData(authQueryKey, null)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authQueryKey }),
  })
  const { mutateAsync } = mutation
  const trigger = useCallback(
    (returnTo?: string) => ({
      unwrap: () => mutateAsync(returnTo),
    }),
    [mutateAsync]
  )
  return [
    trigger,
    { isLoading: mutation.isPending, error: mutation.error },
  ] as const
}
