import { Router } from "express"
import { labAuth } from "@/controllers/lab"
import { requireAuth } from "@/middlewares/auth"

const router = Router()

router.get("/", requireAuth(), labAuth)
router.get("/auth", requireAuth(), labAuth)

export default router
