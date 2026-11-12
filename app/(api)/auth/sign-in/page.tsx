import { SignInRedirect } from "@/components/auth/sign-in-redirect"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    returnTo?: string | string[]
    redirect?: string | string[]
  }>
}) {
  const params = await searchParams
  const candidate = params.returnTo ?? params.redirect
  const path = typeof candidate === "string" ? candidate : "/chat"
  const returnTo =
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.includes("\\") &&
    !path.startsWith("/auth")
      ? path
      : "/chat"
  return (
    <div className="flex min-h-svh items-center justify-center">
      <SignInRedirect returnTo={returnTo} />
    </div>
  )
}
