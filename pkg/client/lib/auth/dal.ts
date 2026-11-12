import "server-only"
import { cache } from "react"
import { cookies } from "next/headers"
import {
  AuthError,
  assertMutationOrigin,
} from "@gorth/structure/modules/auth/server"
import { readBackendSession } from "@/lib/auth/session"
import { clientUrl, sessionAppCookie } from "@/utils/environment"

export async function sessionHandle() {
  const matches = (await cookies()).getAll(sessionAppCookie)
  const handle = matches.length === 1 ? matches[0]!.value : ""
  return /^[A-Za-z0-9_-]{43}$/.test(handle) ? handle : null
}

export async function readSession(fresh = false) {
  const handle = await sessionHandle()
  if (!handle) return null
  try {
    return (await readBackendSession(handle, fresh)).session
  } catch {
    throw new AuthError("unavailable")
  }
}

export async function verifySession(fresh = false) {
  const session = await readSession(fresh)
  return session
    ? {
        user: session.user,
        sso_sub: session.user.id,
        email: session.user.email,
        expires_at: session.expiresAt,
      }
    : null
}

// React cache deduplicates only inside a server render, never across users or
// across API requests. The authoritative session remains in Hono's database.
export const getUser = cache(
  async (fresh = false) => (await verifySession(fresh))?.user ?? null
)

export async function authorizeProxy(request: Request) {
  try {
    const mutation = !["GET", "HEAD", "OPTIONS"].includes(request.method)
    if (mutation)
      assertMutationOrigin(request.headers, [new URL(clientUrl).origin])
    const handle = await sessionHandle()
    const result = handle
      ? await readBackendSession(handle, mutation)
      : { token: null, cookies: [] }
    if (result.token)
      return { token: result.token, cookies: result.cookies, response: null }
    const response = Response.json(
      { error: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    )
    for (const cookie of result.cookies)
      response.headers.append("Set-Cookie", cookie)
    return { token: null, cookies: result.cookies, response }
  } catch (error) {
    const forbidden =
      error instanceof AuthError &&
      (error.code === "forbidden" || error.code === "rejected")
    return {
      token: null,
      cookies: [],
      response: Response.json(
        { error: forbidden ? "invalid_origin" : "auth_unavailable" },
        {
          status: forbidden ? 403 : 503,
          headers: { "Cache-Control": "no-store" },
        }
      ),
    }
  }
}
