import { Hono } from "hono"
import type { ApiEnv } from "@/utils/interface"
import { labAuth } from "@/controllers/lab"
import { requireAuth } from "@/middlewares/auth"

const router = new Hono<ApiEnv>()

router.get("/", requireAuth(), labAuth)
router.get("/auth", requireAuth(), labAuth)

export default router
