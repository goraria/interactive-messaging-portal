import { verifySession } from "@/lib/auth/dal"
import { redirect } from "next/navigation"
import { getAccountDisplayName } from "@/lib/utils/formatter"

export default async function SettingPage() {
  const session = await verifySession()
  if (!session?.user) {
    redirect("/")
  }

  const displayName = getAccountDisplayName(session.user)

  return (
    <div>
      <div>Dashboard setting</div>
      <h1>Welcome {displayName}</h1>
    </div>
  )
}
