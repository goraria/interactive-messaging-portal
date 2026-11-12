import type { Context } from "hono"
import type { ApiEnv } from "@/utils/interface"
export function labAuth(context: Context<ApiEnv>) {
  const auth = context.get("auth")
  return context.json(auth)
}
