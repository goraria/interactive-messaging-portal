import { redirect } from "next/navigation"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; redirect?: string }>
}) {
  const params = await searchParams
  // SSO's account chooser supplies Add another account / account creation.
  redirect(
    "/auth/sign-in?returnTo=" +
      encodeURIComponent(params.returnTo ?? params.redirect ?? "/chat")
  )
}
