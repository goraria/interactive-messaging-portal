import { Hono } from "hono";
import { requireAuth } from "@/middlewares/auth";
import { actSetChatBlock } from "@/controllers/chat";

export const blockRoutes = new Hono();
blockRoutes.post("/:id", requireAuth(), actSetChatBlock);
blockRoutes.delete("/:id", requireAuth(), actSetChatBlock);
