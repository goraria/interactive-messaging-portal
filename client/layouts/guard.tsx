"use client"

import { useEffect, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"

import { LoadingScreen } from "@/features/shared/loading"
import { useAuth } from "@/hooks/use-auth"

export interface AuthGuardProps {
  children: ReactNode
  publicPrefixes?: readonly string[]
  redirectTo?: string
}

export function AuthGuard({
  children,
  publicPrefixes = [],
  redirectTo = "/",
}: AuthGuardProps) {
  const pathname = usePathname()
  const router = useRouter()
  const auth = useAuth()
  const isPublic =
    pathname === "/" ||
    publicPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
    )

  useEffect(() => {
    if (!isPublic && !auth.loading && !auth.authenticated) {
      router.replace(redirectTo)
    }
  }, [
    auth.authenticated,
    auth.loading,
    isPublic,
    redirectTo,
    router,
  ])

  if (!isPublic && (auth.loading || !auth.authenticated)) {
    return <LoadingScreen />
  }

  return children
}
