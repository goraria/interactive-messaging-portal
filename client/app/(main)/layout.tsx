import { cookies } from "next/headers"
import type { ReactNode } from "react"
import { MainLayout } from "@/layouts/main-layout"

function parseSidebarCookie(value: string | undefined, fallback: boolean) {
  return value === undefined ? fallback : value === "true"
}

export default async function Layout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  const cookieStore = await cookies()
  const initialLeftOpen = parseSidebarCookie(
    cookieStore.get("sidebar_state")?.value,
    true
  )

  return <MainLayout initialLeftOpen={initialLeftOpen}>{children}</MainLayout>
}
