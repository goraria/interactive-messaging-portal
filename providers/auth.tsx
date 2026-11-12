"use client"

import { type PropsWithChildren, useCallback, useMemo, useState } from "react"
import { AuthContext } from "@/hooks/use-auth"
import type { AuthContextValue } from "@/utils/interface"
import {
  login as requestLogin,
  register as requestRegister,
  useAuthAccount,
  useAuthLogoutMutation,
} from "@/services/client/auth"

export function AuthProvider({ children }: PropsWithChildren) {
  const { account, loading: accountLoading, error, refresh } = useAuthAccount()
  const [logoutMutation, logoutState] = useAuthLogoutMutation()
  const [actionError, setActionError] = useState<Error | null>(null)

  const login = useCallback(async (returnTo = "/chat") => {
    setActionError(null)
    try {
      await requestLogin(returnTo)
    } catch {
      setActionError(new Error("Sign in is unavailable. Please try again."))
    }
  }, [])

  const register = useCallback(async (returnTo = "/chat") => {
    setActionError(null)
    try {
      await requestRegister(returnTo)
    } catch {
      setActionError(new Error("Sign up is unavailable. Please try again."))
    }
  }, [])

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
      error: actionError ?? error ?? null,
      authenticated: Boolean(account),
      refresh,
      login,
      register,
      logout,
    }),
    [
      account,
      accountLoading,
      actionError,
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
