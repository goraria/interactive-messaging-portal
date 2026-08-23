"use client"

import { useAuth } from "@/hooks/use-auth"
import { useCurrentUserQuery } from "@/services/chat"

export function useUser() {
  const auth = useAuth()
  const query = useCurrentUserQuery(auth.authenticated, auth.account?.id)

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
