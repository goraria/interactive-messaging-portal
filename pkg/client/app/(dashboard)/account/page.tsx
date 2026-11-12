import { redirect } from "next/navigation"

import { authUrl } from "@/utils/environment"

export default function AccountPage() {
  redirect(new URL("/setting", authUrl!).toString())
}
