"use client"

import React, { useEffect } from "react"
import { useRouter } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@gorth/primitive/custom/sidebar"
import { Dashbar } from "@/layouts/dashbar"
import { AppSidebar } from "@gorth/primitive/dashboard/app-sidebar"
import { settingSidebar, visitor } from "@/lib/utils/constant"
import { useAuth } from "@/hooks/use-auth"
import { toNavigationUser } from "@/lib/utils/formatter"

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const router = useRouter()
  const authControls = useAuth()
  const sidebar = {
    ...settingSidebar,
    user: authControls.account
      ? toNavigationUser(authControls.account)
      : visitor,
  }

  useEffect(() => {
    if (
      !authControls.loading &&
      !authControls.authenticated &&
      !authControls.error
    ) {
      router.replace("/")
    }
  }, [
    authControls.authenticated,
    authControls.error,
    authControls.loading,
    router,
  ])

  if (
    !authControls.loading &&
    !authControls.authenticated &&
    !authControls.error
  ) {
    return null
  }

  return (
    <SidebarProvider>
      <AppSidebar data={sidebar} auth={authControls} />

      <SidebarInset>
        <Dashbar />
        <main className="flex flex-1 flex-col">
          <div className="container mx-auto p-6">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
