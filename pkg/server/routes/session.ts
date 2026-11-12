import { Hono } from "hono"
import { setCookie } from "hono/cookie"
import {
  AuthError,
  loginTransactionSchema,
  resolveReturnPath,
} from "@gorth/structure/modules/auth/server"
import { getAuthRuntime } from "@/lib/auth/runtime"
import {
  assertSameOrigin,
  assertSessionReadOrigin,
  getAuthConfig,
  openAuthData,
  sealAuthData,
} from "@/lib/auth/config"
import {
  authCookieOptions,
  clearAppCookies,
  clearTransactionCookies,
  readAuthCookie,
  readSessionHandle,
  setCredentialCookies,
  setSessionCookie,
} from "@/lib/auth/cookies"
import { oauthStateCookie } from "@/utils/environment"
import { formatPublicSession } from "@/utils/formatter"

const router = new Hono()

router.use("*", async (context, next) => {
  const startedAt = performance.now()
  await next()
  context.header("Cache-Control", "no-store")
  context.header("Referrer-Policy", "no-referrer")
  context.header(
    "Server-Timing",
    `auth;dur=${(performance.now() - startedAt).toFixed(1)}`
  )
})

// Retire the credential-returning RPC even for callers sending old x-bff-* headers.
router.all("/session", (context) => context.json({ error: "not_found" }, 404))

router.get("/start", async (context) => {
  try {
    const origin = context.req.header("origin")
    if (origin && origin !== getAuthConfig().origin)
      return context.json({ error: "invalid_origin" }, 403)
    readAuthCookie(context.req.raw, oauthStateCookie)
    const mode = context.req.query("mode")
    const login = await getAuthRuntime().provider.startLogin(
      context.req.query("returnTo") ?? context.req.query("redirect") ?? "/",
      mode === "sign-up" || mode === "register" ? "create" : "select_account"
    )
    const transaction = loginTransactionSchema.parse(login.transaction)
    setCookie(
      context,
      oauthStateCookie,
      await sealAuthData(
        { ...transaction },
        "transaction",
        new Date(transaction.expiresAt)
      ),
      { ...authCookieOptions, path: "/auth", maxAge: 120 }
    )
    return context.redirect(login.url, 302)
  } catch (error) {
    console.error("[auth/start]", {
      code: error instanceof AuthError ? error.code : "unavailable",
    })
    return context.json({ error: "auth_unavailable" }, 503)
  }
})

router.get("/exchange", async (context) => {
  let config: ReturnType<typeof getAuthConfig>
  try {
    config = getAuthConfig()
  } catch {
    return context.json({ error: "auth_unavailable" }, 503)
  }
  let target = "/?auth=failed"
  try {
    const cookie = readAuthCookie(context.req.raw, oauthStateCookie)
    if (!cookie || cookie.length > 8192) throw new AuthError("rejected")
    const transaction = loginTransactionSchema.parse(
      await openAuthData(cookie, "transaction")
    )
    // Internal Host / forwarded headers must never define the OAuth callback.
    const callback = new URL("/auth/exchange", config.origin)
    callback.search = new URL(context.req.url).search
    const auth = getAuthRuntime()
    const login = await auth.provider.finishLogin(callback.href, transaction)
    const result = await auth.sessions.create(login)
    setSessionCookie(context, result.handle, result.session.expiresAt)
    target = resolveReturnPath(login.returnTo)
  } catch {
    if (context.req.query("error") === "access_denied")
      target = "/?auth=cancelled"
    // A failed account switch preserves the previous app session.
  }
  clearTransactionCookies(context)
  return context.redirect(new URL(target, config.origin).href, 302)
})

router.get("/me", async (context) => {
  try {
    assertSessionReadOrigin(context.req.raw)
  } catch (error) {
    if (error instanceof AuthError && error.code === "forbidden")
      return context.json({ error: "invalid_origin" }, 403)
    return context.json({ user: null, error: "auth_unavailable" }, 503)
  }
  try {
    const handle = readSessionHandle(context.req.raw)
    const record = handle
      ? await getAuthRuntime().credentials(
          handle,
          context.req.query("fresh") === "1"
        )
      : null
    if (!record) {
      clearAppCookies(context)
      return context.json({ user: null, session: null }, 401)
    }
    setCredentialCookies(context, record)
    const session = formatPublicSession(record)
    return context.json({ user: session.user, session })
  } catch {
    // Do not erase an existing session on a DB/SSO outage.
    return context.json({ user: null, error: "auth_unavailable" }, 503)
  }
})

router.delete("/me", async (context) => {
  try {
    assertSameOrigin(context.req.raw)
  } catch (error) {
    if (
      error instanceof AuthError &&
      (error.code === "forbidden" || error.code === "rejected")
    )
      return context.json({ error: "invalid_origin" }, 403)
    return context.json({ error: "auth_unavailable" }, 503)
  }
  try {
    const handle = readSessionHandle(context.req.raw)
    const result = handle
      ? await getAuthRuntime().signOut(handle)
      : { remoteRevoked: true }
    clearAppCookies(context)
    context.header(
      "X-Gorth-Revocation",
      result.remoteRevoked ? "confirmed" : "pending"
    )
    return context.json({ user: null })
  } catch {
    return context.json({ error: "auth_unavailable" }, 503)
  }
})

export default router
