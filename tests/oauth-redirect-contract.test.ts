import { readFileSync } from "node:fs"
import { expect, it } from "vitest"

it("uses the registered local Chat client for the localhost example, independently of NODE_ENV", () => {
  const values = Object.fromEntries(
    readFileSync(new URL("../.env.example", import.meta.url), "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const i = line.indexOf("=")
        return [line.slice(0, i), line.slice(i + 1)]
      })
  )
  expect(values.NEXT_PUBLIC_OAUTH_CLIENT_ID).toBe(
    "gorth-interactive-messaging-portal-local"
  )
  expect(new URL("/auth/callback/gorth", values.NEXT_PUBLIC_APP_URL).href).toBe(
    "http://localhost:3030/auth/callback/gorth"
  )
  expect(values.NEXT_PUBLIC_AUTH_URL).toBe("https://gorth-auth.vercel.app")
})
