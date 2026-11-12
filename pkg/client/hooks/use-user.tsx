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

  const user =
    auth.account && query.data
      ? {
          ...query.data,
          name: auth.account.name,
          email: auth.account.email,
          image: auth.account.image,
          avatar: auth.account.image ?? "",
          username: auth.account.username,
        }
      : null
  const loading = auth.loading || (auth.authenticated && query.isPending)

  return {
    user,
    username: auth.username,
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
