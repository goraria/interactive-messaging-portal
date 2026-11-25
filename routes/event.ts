import { Hono } from "hono";
import { requireChatMachine } from "@/middlewares/machine";
import { actDispatchChatEvents } from "@/controllers/chat";

export const eventRoutes = new Hono();
eventRoutes.post("/dispatch", requireChatMachine(), actDispatchChatEvents);
