import type { Context } from "hono";
import type { ApiEnv } from "@/utils/interface";
import { getParam } from "@/utils/controller";
import { rawGetOAuthProtectedResourceMetadata } from "@/services/sso";

export function actHello(context: Context<ApiEnv>) {
  return context.json({ message: "Hello Next.js!" });
}

export function actHealth(context: Context<ApiEnv>) {
  return context.json({ status: "ok", timestamp: new Date().toISOString() });
}
export function actQuery(context: Context<ApiEnv>) {
  return context.json({ query: context.req.query("query") });
}
export function actParam(context: Context<ApiEnv>) {
  return context.json({ param: getParam(context, "param") });
}
export function actProtectedResourceMetadata(context: Context<ApiEnv>) {
  return context.json(rawGetOAuthProtectedResourceMetadata());
}
