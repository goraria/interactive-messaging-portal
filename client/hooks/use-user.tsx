"use client"

import { useQuery } from "@gorth/primitive/cores/tanstack/query"
import { useAuth } from "@/hooks/use-auth"
import { currentUserQueryKey, getCurrentUser } from "@/services/chat"

export function useUser() {
  const auth = useAuth()
  const query = useQuery({
    queryKey: [...currentUserQueryKey, auth.account?.id],
    queryFn: getCurrentUser,
    enabled: auth.authenticated && Boolean(auth.account?.id),
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  async function refresh() {
    const account = await auth.refresh()

    if (!account) {
      return null
    }

    const result = await query.refetch()
    return result.data ?? null
  }

  const user = auth.authenticated ? (query.data ?? null) : null
  const loading = auth.loading || (auth.authenticated && query.isPending)

  return {
    user,
    raw: auth.account,
    isLoggedIn: auth.authenticated,
    isLoading: loading,
    loading,
    error: auth.error ?? query.error,
    refresh,
    session: undefined,
  }
}

export function useAccount() {
  return null
}
