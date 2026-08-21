import { redirect } from "next/navigation"
import { getValue } from "@/lib/utils/formatter"

interface PageProps {
  searchParams: Promise<{
    redirect?: string | string[]
    returnTo?: string | string[]
  }>
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams
  const returnTo = getValue(params.returnTo) ?? getValue(params.redirect) ?? "/"

  redirect(`/auth/start?mode=sign-in&returnTo=${encodeURIComponent(returnTo)}`)
}
