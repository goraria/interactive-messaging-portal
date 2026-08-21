import { Router } from "express"
import { me, splat, syncUser } from "@/controllers/auth"
import { requireAuth } from "@/middlewares/auth"

const router = Router()

// router.all("/api/auth/*", toNodeHandler(auth)); // For ExpressJS v4
// router.all("/api/auth/*splat", toNodeHandler(auth)); // For ExpressJS v5
router.post("/sync-user", requireAuth(), syncUser)
router.all("/*splat", splat) // For ExpressJS v5

router.get("/me", me)

export default router
