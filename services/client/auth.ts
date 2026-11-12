"use client"
import { useCallback } from "react"
import {
  useMutation,
  useQueryClient,
} from "@gorth-io/primitive/cores/tanstack/query"
import { authClient } from "@/lib/auth/browser"
import { resetCallerAuthentication } from "@/lib/auth/client"
import { resolveInternalPath } from "@/utils/client/formatter"
import { formatAuthUser } from "@/utils/client/formatter"
import type { AuthMeResponse, AuthUser } from "@/utils/interface"

export async function me(): Promise<AuthUser | null> {
  const result = await authClient.getSession()
  if (result.error)
    throw new Error(result.error.message ?? "Session unavailable")
  return result.data ? formatAuthUser(result.data.user) : null
}
export function useAuthAccount() {
  const { data, isPending, error } = authClient.useSession()
  const refresh = useCallback(async () => me(), [])
  return {
    account: data ? formatAuthUser(data.user) : null,
    loading: isPending && !data,
    error: error ? new Error(error.message ?? "Session unavailable") : null,
    refresh,
  }
}
export async function login(returnTo: unknown = "/") {
  resetCallerAuthentication()
  const result = await authClient.signIn.social({
    provider: "gorth",
    callbackURL: resolveInternalPath(returnTo),
    errorCallbackURL: "/auth/error",
  })
  if (result.error) throw new Error(result.error.message ?? "Sign in failed")
}
export async function register(returnTo: unknown = "/") {
  // Account creation is owned by SSO's chooser, not a second password authority.
  return login(returnTo)
}
export async function logout(returnTo = "/") {
  resetCallerAuthentication()
  const result = await authClient.signOut()
  if (result.error) throw new Error(result.error.message ?? "Sign out failed")
  window.location.replace(resolveInternalPath(returnTo))
}
export function useAuthLogoutMutation() {
  const queryClient = useQueryClient()
  const mutation = useMutation<AuthMeResponse, Error, string | undefined>({
    mutationFn: async (returnTo) => {
      await logout(returnTo)
      return { user: null }
    },
    onSuccess: () => queryClient.clear(),
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
