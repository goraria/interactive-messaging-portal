import { readFileSync } from "node:fs"
import { expect, it } from "vitest"
import {
  AuthError,
  createIdentityCache,
  createOAuthIdentityValidator,
} from "@gorth-io/structure/modules/auth/server"

const read = (path: string) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8")
const manifest = JSON.parse(read("package.json"))

it("limits the fullstack workspace to the app root, not the archived pkg", () => {
  expect(manifest.packageManager).toMatch(/^bun@/)
  expect(JSON.parse(read("tsconfig.json")).exclude).toContain("pkg")
})

it("keeps Better Auth app-owned and uses public Structure infrastructure exports", () => {
  expect(manifest.dependencies["better-auth"]).toBeTruthy()
  expect(manifest.dependencies["@gorth-io/structure"]).toBeTruthy()
  for (const dependency of [
    "axios",
    "zod",
    "jose",
    "pg",
    "uuid",
    "ably",
    "@supabase/supabase-js",
    "@supabase/ssr",
    "vaul",
  ]) {
    expect(manifest.dependencies[dependency], dependency).toBeUndefined()
  }
  expect(createIdentityCache).toBeTypeOf("function")
  expect(createOAuthIdentityValidator).toBeTypeOf("function")
  expect(new AuthError("rejected").code).toBe("rejected")
})

it("delegates identity cache and OAuth validation without wrapping the SDK exports", () => {
  const cache = read("services/sso-userinfo.ts")
  const provider = read("lib/auth/provider.ts")
  expect(cache).toContain("createUserInfoCache")
  expect(cache).not.toContain("new Map")
  expect(provider).toContain("createOAuthIdentityValidator")
  expect(provider).toContain('from "better-auth/plugins/generic-oauth"')
  expect(provider).not.toContain("cores/auth")
})
