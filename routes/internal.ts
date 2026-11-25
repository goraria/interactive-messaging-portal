import { Hono } from "hono";
import { requireChatMachine } from "@/middlewares/machine";
import { actChatStorageCredential } from "@/controllers/chat";

export const internalRoutes = new Hono();
internalRoutes.post(
  "/storage/credential",
  requireChatMachine(true),
  actChatStorageCredential,
);
