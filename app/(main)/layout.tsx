import { cookies } from "next/headers"
import type { ReactNode } from "react"
import { MainLayout } from "@/layouts/main-layout"
import { parseBoolean } from "@/utils/client/formatter"

export default async function Layout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  const cookieStore = await cookies()
  const initialLeftOpen = parseBoolean(
    cookieStore.get("sidebar_state")?.value,
    true
  )

  return <MainLayout initialLeftOpen={initialLeftOpen}>{children}</MainLayout>
}
