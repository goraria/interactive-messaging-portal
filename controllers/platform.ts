import "server-only";
import type { Context } from "hono";
import type { SessionEnv } from "@/middlewares/session";
import {
  oauthDiscoveryAudience,
  oauthNotifyAudience,
  oauthResourceAudience,
  oauthPaymentAudience,
  oauthBillingAudience,
  oauthMediaAudience,
  oauthInsightAudience,
  oauthCommerceAudience,
  isProduction,
} from "@/utils/environment";
import { rawForwardRouteRequest } from "@/services/route";

export async function actForwardPlatform(context: Context<SessionEnv>) {
  const source = new URL(context.req.url);
  const pathname = source.pathname.slice("/external".length);
  const domain = pathname.split("/")[1];
  const upstream =
    domain === "resource"
      ? oauthResourceAudience
      : domain === "discovery"
        ? oauthDiscoveryAudience
        : domain === "notification"
          ? oauthNotifyAudience
          : domain === "payment"
            ? oauthPaymentAudience
            : domain === "billing"
              ? oauthBillingAudience
              : domain === "media"
                ? oauthMediaAudience
                : domain === "insight"
                  ? oauthInsightAudience
                  : domain === "commerce"
                    ? oauthCommerceAudience
                    : "";
  if (!upstream) return context.json({ error: "service_unavailable" }, 503);
  const base = new URL(upstream);
  if (
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    base.pathname !== "/" ||
    (base.protocol !== "https:" &&
      (isProduction ||
        base.protocol !== "http:" ||
        !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)))
  )
    return context.json({ error: "service_unavailable" }, 503);
  const target = new URL(base);
  // Assign the pathname, never resolve browser input as an absolute URL.
  target.pathname = pathname;
  target.search = source.search;
  if (domain === "discovery" && ["GET", "HEAD"].includes(context.req.method))
    target.searchParams.set("application", "chat");
  if (
    domain === "billing" &&
    ["/billing/catalog", "/billing/entitlement"].includes(pathname)
  )
    target.searchParams.set("application", "chat");
  const headers = new Headers();
  for (const name of [
    "accept",
    "content-type",
    "if-match",
    "if-none-match",
    "idempotency-key",
    "x-request-id",
  ]) {
    const value = context.req.header(name);
    if (value) headers.set(name, value);
  }
  headers.set(
    "authorization",
    `Bearer ${context.get("credentials").credentials.accessToken}`,
  );
  const authCookies = context.res.headers.getSetCookie();
  try {
    const result = await rawForwardRouteRequest({
      url: target,
      method: context.req.method,
      headers,
      body: ["GET", "HEAD"].includes(context.req.method)
        ? undefined
        : await context.req.arrayBuffer(),
    });
    // A platform response must not overwrite this application's session cookies.
    result.headers.delete("set-cookie");
    for (const cookie of authCookies)
      result.headers.append("Set-Cookie", cookie);
    result.headers.delete("location");
    return result;
  } catch {
    return context.json({ error: "service_unavailable" }, 502);
  }
}
