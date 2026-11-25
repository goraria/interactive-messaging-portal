import type { Context } from "hono";
import type { ApiEnv } from "@/utils/interface";
export function actLabAuth(context: Context<ApiEnv>) {
  const auth = context.get("auth");
  return context.json(auth);
}
