import { redirect } from "next/navigation"

import { authUrl } from "@/lib/utils/environment"

export default function AccountPage() {
  redirect(new URL("/settings", authUrl!).toString())
}
