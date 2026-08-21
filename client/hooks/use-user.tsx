"use client"

import { useQuery } from "@gorth/primitive/cores/tanstack/query"
import { useAuth } from "@/hooks/use-auth"
import { currentUserQueryKey, getCurrentUser } from "@/services/chat"
import { getAccountDisplayName } from "@/lib/utils/formatter"

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
  const auth = useAuth()
  const { user, loading: userLoading } = useUser()
  const metadata = auth.account?.user_metadata ?? {}

  return {
    user,
    sidebarUser: {
      name: getAccountDisplayName(user?.name, auth.account?.email, metadata),
      email: user?.email ?? auth.account?.email ?? "guest@gorth.com",
      avatar:
        user?.image ??
        String(metadata.avatar_url ?? metadata.picture ?? "/logo/icon.png"),
    },
    auth: {
      account: auth.account,
      authenticated: auth.authenticated,
      loading: auth.loading || userLoading,
      error: auth.error,
      logout: auth.logout,
      login: auth.login,
      register: auth.register,
    },
  }
}
