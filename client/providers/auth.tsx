"use client"

import { type PropsWithChildren, useCallback, useMemo } from "react"
import { AuthContext } from "@/hooks/use-auth"
import type { AuthContextValue } from "@/lib/utils/interface"
import {
  login as requestLogin,
  register as requestRegister,
  useAuthAccount,
  useAuthLogoutMutation,
} from "@/services/auth"

export function AuthProvider({ children }: PropsWithChildren) {
  const { account, loading: accountLoading, error, refresh } = useAuthAccount()
  const [logoutMutation, logoutState] = useAuthLogoutMutation()

  const login = useCallback(
    (returnTo = "/chat") => {
      if (!account) requestLogin(returnTo)
    },
    [account]
  )

  const register = useCallback(
    (returnTo = "/chat") => {
      if (!account) requestRegister(returnTo)
    },
    [account]
  )

  const logout = useCallback(
    async (returnTo = "/") => {
      await logoutMutation(returnTo).unwrap()
    },
    [logoutMutation]
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      account,
      loading: accountLoading || logoutState.isLoading,
      error: error ?? null,
      authenticated: Boolean(account),
      refresh,
      login,
      register,
      logout,
    }),
    [
      account,
      accountLoading,
      error,
      login,
      logout,
      logoutState.isLoading,
      refresh,
      register,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function Auth({ children }: PropsWithChildren) {
  return <AuthProvider>{children}</AuthProvider>
}
