import { verifySession } from "@/lib/dal"
import { redirect } from "next/navigation"
import { getAccountDisplayName } from "@/lib/utils/formatter"

export default async function SettingPage() {
  const session = await verifySession()
  if (!session?.user) {
    redirect("/")
  }

  const displayName = getAccountDisplayName(
    undefined,
    session.user.email,
    session.user.user_metadata
  )

  return (
    <div>
      <div>Dashboard setting</div>
      <h1>Welcome {displayName}</h1>
    </div>
  )
}
