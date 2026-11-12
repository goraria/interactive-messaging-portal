import { Hono } from "hono"
import { getCookie } from "hono/cookie"
import { requireAppSession, type SessionEnv } from "@/middlewares/session"

export function demoRoutes() {
  const router = new Hono<SessionEnv>()
  router.post("/call", requireAppSession(), async (context) => {
    let body: unknown
    try {
      body = await context.req.json()
    } catch {
      return context.json({ error: "invalid_json" }, 400)
    }
    return context.json({
      data: {
        id: "hono-router-demo",
        source: "Hono",
        route: context.req.path,
        url: context.req.url,
        method: context.req.method,
        status: "ok",
        generatedAt: new Date().toISOString(),
        params: context.req.query(),
        body,
        headers: Object.fromEntries(
          [...context.req.raw.headers.entries()].filter(
            ([name]) => !["authorization", "cookie"].includes(name)
          )
        ),
        cookieNames: Object.keys(getCookie(context)),
        hasAuthorization: Boolean(context.req.header("authorization")),
      },
      message: "Demo API loaded",
    })
  })
  return router
}
