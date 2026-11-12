import type { Context } from "hono"
import type { ApiEnv } from "@/utils/interface"
import { syncUser as syncUserServices } from "@/services/users"
export async function syncUser(context: Context<ApiEnv>) {
  const auth = context.get("auth")
  if (!auth?.user) {
    return context.json({ error: "unauthorized" }, 401)
  }
  try {
    const user = await syncUserServices({
      id: auth.user.id,
      name: auth.user.name ?? auth.user.email.split("@")[0] ?? auth.user.email,
      username: auth.user.username,
      email: auth.user.email,
      image: auth.user.image,
      status: auth.user.status,
    })
    return context.json({ data: user }, 200)
  } catch (error) {
    throw error
  }
}
