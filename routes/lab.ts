import { Hono } from "hono";
import { actLabAuth } from "@/controllers/lab";
import { requireAuth } from "@/middlewares/auth";

export const labRoutes = new Hono();
labRoutes.get("/", requireAuth(), actLabAuth);
labRoutes.get("/auth", requireAuth(), actLabAuth);
