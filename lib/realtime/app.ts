import "server-only";
import { Hono } from "hono";
import type { UpgradeWebSocket } from "hono/ws";
import { createSocketRoutes } from "@/routes/socket";

export function createRealtimeApp<Socket>(upgrade: UpgradeWebSocket<Socket>) {
  return new Hono().route("/external/socket", createSocketRoutes(upgrade));
}
