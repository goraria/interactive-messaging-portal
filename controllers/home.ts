import type { Context } from "hono";
import { html } from "hono/html";
import type { ApiEnv } from "@/utils/interface";
import { rawReadAppIdentity } from "@/models/session";
import { Home, HomeError } from "@/features/home/index";

export async function actHome(context: Context<ApiEnv>) {
  try {
    const identity = await rawReadAppIdentity(context.req.raw.headers);
    if (identity) return context.redirect("/chat", 302);
    return context.html(html`<!doctype html>${Home()}`);
  } catch {
    return context.html(html`<!doctype html>${HomeError()}`, 503);
  }
}
