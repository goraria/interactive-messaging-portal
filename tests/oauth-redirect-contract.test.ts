import { readFileSync } from "node:fs"
import { expect, it } from "vitest"

it("uses one OAuth client ID and the existing localhost callback", () => {
  const values = Object.fromEntries(
    readFileSync(new URL("../.env.example", import.meta.url), "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const i = line.indexOf("=")
        return [line.slice(0, i), line.slice(i + 1)]
      })
  )
  expect(values.NEXT_OAUTH_CLIENT_ID).toEqual(expect.stringMatching(/\S/))
  expect(values).not.toHaveProperty("NEXT_PUBLIC_OAUTH_CLIENT_ID")
  expect(new URL("/auth/callback/gorth", values.NEXT_PUBLIC_APP_URL).href).toBe(
    "http://localhost:3030/auth/callback/gorth"
  )
  expect(values.NEXT_PUBLIC_AUTH_URL).toBe("https://gorth-auth.vercel.app")
})
