"use client"

import { caller } from "@/utils/caller"
import { resetCallerAuthentication } from "@/lib/auth/client"
import { z } from "@gorth/structure/cores/zod"
import {
  AuthError,
  createAuthClient,
} from "@gorth/structure/modules/auth/client"
import type { AuthUser } from "@/utils/interface"

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

export const authClient = createAuthClient<AuthUser>({
  async read(signal) {
    const response = await caller<{ status: number; data: unknown }>({
      url: "/auth/me",
      method: "GET",
      baseURL: null,
      auth: false,
      responseHandler: (response) => ({
        status: response.status,
        data: response.data,
      }),
      // The server checks expiry, local permissions and revocation on every
      // read; its 120-second identity policy decides when SSO is needed.
      signal,
      withCredentials: true,
      timeout: 60_000,
      headers: { "Cache-Control": "no-store" },
      validateStatus: () => true,
    })
    if (response.status === 401) return null
    if (response.status !== 200) throw new AuthError("unavailable")
    const { session } = z
      .object({ session: publicSessionSchema.nullable() })
      .parse(response.data)
    return session
  },
  async login(input, signal) {
    resetCallerAuthentication()
    signal.throwIfAborted()
    const url = new URL("/auth/start", window.location.origin)
    url.searchParams.set("returnTo", input.returnTo)
    url.searchParams.set(
      "mode",
      input.prompt === "create" ? "sign-up" : "sign-in"
    )
    window.location.assign(url.href)
    return { status: "redirecting" }
  },
  async logout(signal) {
    resetCallerAuthentication()
    const response = await caller<{ status: number; data: unknown }>({
      url: "/auth/me",
      method: "DELETE",
      baseURL: null,
      auth: false,
      responseHandler: (response) => ({
        status: response.status,
        data: response.data,
      }),
      signal,
      withCredentials: true,
      timeout: 60_000,
      validateStatus: () => true,
    })
    if (response.status !== 200) throw new AuthError("unavailable")
    z.object({ user: z.null() }).parse(response.data)
    window.location.replace(new URL("/", window.location.origin).href)
  },
})
