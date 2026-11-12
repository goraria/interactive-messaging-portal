"use client"
import { createAuthClient } from "better-auth/react"
import { inferAdditionalFields } from "better-auth/client/plugins"
import type { getAuth } from "@/lib/auth/server"

export const authClient = createAuthClient({
  basePath: "/auth",
  sessionOptions: { refetchInterval: 0 },
  plugins: [inferAdditionalFields<ReturnType<typeof getAuth>>()],
})
