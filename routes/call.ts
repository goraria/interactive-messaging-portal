import { Hono } from "hono";
import { requireAuth } from "@/middlewares/auth";
import {
  actListChatSignals,
  actSignalChatCall,
  actChatIceConfiguration,
  actIncomingChatCalls,
} from "@/controllers/chat";

export const callRoutes = new Hono();
callRoutes.get("/:id/signal", requireAuth(), actListChatSignals);
callRoutes.post("/:id/signal", requireAuth(), actSignalChatCall);
callRoutes.get("/ice", requireAuth(), actChatIceConfiguration);
callRoutes.get("/incoming", requireAuth(), actIncomingChatCalls);
