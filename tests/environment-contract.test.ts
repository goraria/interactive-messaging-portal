import { readFileSync } from "node:fs"
import { expect, it } from "vitest"

it("declares every application environment read in the public example", () => {
  const source = readFileSync(
    new URL("../utils/environment.ts", import.meta.url),
    "utf8"
  )
  const example = readFileSync(
    new URL("../.env.example", import.meta.url),
    "utf8"
  )
  const names = new Set(
    [...example.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1])
  )
  for (const [, name] of source.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
    if (!["NODE_ENV", "NEXT_RUNTIME", "NEXT_PHASE"].includes(name!))
      expect(names.has(name), name).toBe(true)
  }
  for (const obsolete of [
    "NEXT_PUBLIC_SSO_CLIENT_URL",
    "NEXT_PUBLIC_SSO_OAUTH_CLIENT_ID",
    "NEXT_SSO_SERVER_URL",
    "NEXT_RESOURCE_INTERACTION_SERVER_URL",
    "NEXT_DISCOVERY_ENGINE_SERVER_URL",
    "NEXT_NOTIFICATION_CENTER_SERVER_URL",
  ]) {
    expect(source).not.toContain(obsolete)
    expect(names.has(obsolete)).toBe(false)
  }
})
