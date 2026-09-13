"use client"

import { createContext, useContext } from "react"
import type { AuthContextValue } from "@/lib/utils/interface"

export const AuthContext = createContext<AuthContextValue>({
  account: null,
  loading: true,
  error: null,
  authenticated: false,
  refresh: async () => null,
  login: () => undefined,
  register: () => undefined,
  logout: async () => undefined,
})

export function useAuth() {
  const auth = useContext(AuthContext)

  return {
    ...auth,
    username: auth.account?.username ?? null,
  }
}
