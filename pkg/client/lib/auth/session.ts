import "server-only"
import { AuthError } from "@gorth/structure/modules/auth/server"
import { z } from "@gorth/structure/cores/zod"
import {
  accessTokenCookie,
  clientUrl,
  serverUrl,
  sessionAppCookie,
} from "@/utils/environment"
import { fetcher } from "@/utils/fetcher"

const publicSessionSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.email(),
    username: z.string().nullable(),
    image: z.string().nullable(),
  }),
  expiresAt: z.number(),
})

// This is the same public cookie endpoint the browser uses, not a privileged
// credential-returning RPC. Only the app handle is forwarded, never SSO cookies.
export async function readBackendSession(handle: string, fresh = false) {
  const target = new URL("/auth/me", serverUrl)
  if (fresh) target.searchParams.set("fresh", "1")
  const response = await fetcher<unknown>({
    url: target,
    method: "GET",
    headers: {
      Cookie: `${sessionAppCookie}=${handle}`,
      Origin: new URL(clientUrl).origin,
    },
    timeout: 15_000,
    maxContentLength: 65536,
    redirect: "error",
    cache: "no-store",
    validateStatus: () => true,
  })
  if (response.status !== 200 && response.status !== 401)
    throw new AuthError("unavailable")
  const setCookie = response.headers["set-cookie"]
  const cookies = Array.isArray(setCookie)
    ? setCookie
    : typeof setCookie === "string"
      ? [setCookie]
      : []
  if (response.status === 401) return { session: null, token: null, cookies }
  const { session } = z
    .object({ session: publicSessionSchema })
    .parse(response.data)
  // Use the authoritative token refreshed by Hono, not an incoming/stale
  // access-token cookie. Credentials are never part of the public JSON DTO.
  const issued = cookies.find((cookie) =>
    cookie.startsWith(accessTokenCookie + "=")
  )
  const token = issued
    ? decodeURIComponent(
        issued.split(";", 1)[0]!.slice(accessTokenCookie.length + 1)
      )
    : null
  if (!token || /[\r\n]/.test(token)) throw new AuthError("unavailable")
  return { session, token, cookies }
}
