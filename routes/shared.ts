import { Hono } from "hono"
import type { ApiEnv } from "@/utils/interface"

const router = new Hono<ApiEnv>()
router.get("/health", (context) =>
  context.json({ status: "ok", timestamp: new Date().toISOString() })
)
router.get("/param/:param", (context) =>
  context.json({ param: context.req.param("param") })
)
router.get("/query", (context) =>
  context.json({ query: context.req.query("query") })
)
// Next owns HTML, favicon and public assets; do not mount the old static server.
export default router
