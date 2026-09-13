"use client"

import React from "react"
import { SidebarProvider, SidebarInset } from "@gorth/primitive/custom/sidebar"
import { Dashbar } from "@/layouts/dashbar"
import { DashboardFooter } from "@/layouts/footer"
import { AppSidebar } from "@gorth/primitive/dashboard/app-sidebar"
import { settingSidebar, visitor } from "@/lib/utils/constant"
import { useAuth } from "@/hooks/use-auth"
import { useUser } from "@/hooks/use-user"
import { AuthGuard } from "@/layouts/guard"

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const authControls = useAuth()
  const { user } = useUser()
  const sidebar = {
    ...settingSidebar,
    user: user ?? visitor,
  }

  return (
    <AuthGuard>
      <SidebarProvider>
        <AppSidebar data={sidebar} auth={authControls} />

        <SidebarInset>
          <Dashbar />
          <main className="flex flex-1 flex-col">
            <div className="container mx-auto p-6">{children}</div>
          </main>
          <DashboardFooter />
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  )
}
