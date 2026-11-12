import { verifySession } from "@/lib/auth/dal"
import { redirect } from "next/navigation"

export default async function SettingPage() {
  const session = await verifySession()
  if (!session?.user) {
    redirect("/")
  }

  redirect("/setting/notification")
}
