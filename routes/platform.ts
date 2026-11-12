import { Hono } from "hono"
import { requireAppSession, type SessionEnv } from "@/middlewares/session"
import { forwardPlatform } from "@/controllers/platform"

export function platformRoutes() {
  const router = new Hono<SessionEnv>()
  for (const domain of [
    "resource",
    "discovery",
    "notification",
    "payment",
    "billing",
    "media",
    "insight",
  ]) {
    router.on(
      ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
      `/${domain}`,
      requireAppSession(),
      forwardPlatform
    )
    router.on(
      ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
      `/${domain}/*`,
      requireAppSession(),
      forwardPlatform
    )
  }
  return router
}
