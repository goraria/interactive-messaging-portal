import { beforeAll, beforeEach, expect, it, vi } from "vitest"
import {
  generateKeyPair,
  exportJWK,
  SignJWT,
} from "@gorth-io/structure/cores/jose"
vi.mock("@/utils/environment", () => ({
  appUrl: "https://chat-machine.test",
  authUrl: "https://sso-machine.test",
  oauthAudience: "https://chat-audience.test",
  isProduction: true,
  oauthNotifyAudience: "https://notify-machine.test",
  oauthResourceAudience: "https://resource-machine.test",
  oauthDiscoveryAudience: "https://discovery-machine.test",
  oauthMediaAudience: "https://media-machine.test",
  oauthInsightAudience: "https://insight-machine.test",
}))
import { verifyChatBackend } from "@/services/chat-platform"
let pair: Awaited<ReturnType<typeof generateKeyPair>>,
  key: Awaited<ReturnType<typeof exportJWK>>
beforeAll(async () => {
  pair = await generateKeyPair("ES256")
  key = {
    ...(await exportJWK(pair.publicKey)),
    kid: "chat-machine-key",
    alg: "ES256",
  }
})
beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = input instanceof Request ? input.url : String(input)
    if (url !== "https://sso-machine.test/auth/jwks")
      throw new Error("Unexpected network")
    return Response.json({ keys: [key] })
  })
})
async function token(override: Record<string, unknown> = {}, typ = "at+jwt") {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({
    iss: "https://sso-machine.test/auth",
    aud: "https://chat-audience.test",
    sub: "existing-confidential",
    client_id: "existing-confidential",
    iat: now,
    exp: now + 120,
    scope: "chat:dispatch",
    ...override,
  })
    .setProtectedHeader({ alg: "ES256", kid: "chat-machine-key", typ })
    .sign(pair.privateKey)
}
function request(
  bearer?: string,
  headers: Record<string, string | undefined> = {}
) {
  const wire = new Headers()
  for (const [name, value] of Object.entries(headers))
    if (value !== undefined) wire.set(name, value)
  if (bearer) wire.set("Authorization", "Bearer " + bearer)
  return new Request("https://chat-machine.test/chat/event/dispatch", {
    headers: wire,
  })
}
it("verifies a real signed machine JWT through the native Better Auth verifier", async () => {
  await expect(
    verifyChatBackend(request(await token()))
  ).resolves.toBeUndefined()
})
it.each([
  { scope: "chat:read" },
  { sub: "user", sid: "session" },
  { client_id: "different" },
  { iss: "https://foreign.test/auth" },
  { aud: "https://foreign.test" },
  { exp: 1 },
  { iat: 9999999999, exp: 99999999999 },
  { cnf: { jkt: "bound-proof" } },
  { status: "inactive" },
])("rejects invalid or user grants %j", async (override) => {
  await expect(
    verifyChatBackend(request(await token(override)))
  ).rejects.toBeTruthy()
})
it("rejects missing, ID, overlong and tampered tokens", async () => {
  await expect(verifyChatBackend(request())).rejects.toBeTruthy()
  await expect(
    verifyChatBackend(request(await token({}, "JWT")))
  ).rejects.toBeTruthy()
  const now = Math.floor(Date.now() / 1000)
  await expect(
    verifyChatBackend(request(await token({ exp: now + 3600 })))
  ).rejects.toBeTruthy()
  const parts = (await token()).split(".")
  parts[2] = "A".repeat(parts[2]!.length)
  await expect(verifyChatBackend(request(parts.join(".")))).rejects.toBeTruthy()
})
it.each([
  { Cookie: "session=normal" },
  { Origin: "https://chat-machine.test" },
  { "Sec-Fetch-Site": "same-origin" },
])("rejects browser headers even with valid tokens %j", async (headers) => {
  await expect(
    verifyChatBackend(request(await token(), headers))
  ).rejects.toMatchObject({ statusCode: 403 })
})
it("requires the storage URL audience and a 120-second lifetime", async () => {
  const storage = {
    aud: "https://chat-machine.test/internal/storage/credential",
    scope: "storage:chat:credential",
  }
  await expect(
    verifyChatBackend(request(await token(storage)), true)
  ).resolves.toBeUndefined()
  await expect(
    verifyChatBackend(request(await token()), true)
  ).rejects.toBeTruthy()
  await expect(
    verifyChatBackend(
      request(
        await token({ ...storage, exp: Math.floor(Date.now() / 1000) + 300 })
      ),
      true
    )
  ).rejects.toBeTruthy()
})
