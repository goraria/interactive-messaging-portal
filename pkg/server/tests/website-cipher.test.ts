import { createHash } from "node:crypto"
import { expect, it, vi } from "vitest"
import { EncryptJWT, jwtDecrypt } from "@gorth/principle/cores/jose"
import { sealAuthData, openAuthData } from "@/lib/auth/crypto"
import packageInfo from "@/package.json"

const fixture = vi.hoisted(() => ({
  secret: "fixture-secret-" + "x".repeat(32),
}))
vi.mock("@/utils/environment", () => ({ authSecret: fixture.secret }))
vi.mock("@/lib/auth/config", () => ({
  getAuthConfig: () => ({
    origin: "https://website.test",
    clientId: "fixture-web",
  }),
}))

const namespace = packageInfo.name.includes("launcher")
  ? "launcher-website"
  : "browser-website"
const key = (purpose: string) =>
  createHash("sha256")
    .update(namespace + ":" + purpose + ":" + fixture.secret)
    .digest()

it("writes Structure ciphertext and reads its original public data", async () => {
  const data = {
    subject: "fixture-subject",
    accessToken: "fixture-private-token",
  }
  const value = await sealAuthData(
    data,
    "credentials",
    new Date(Date.now() + 60_000)
  )
  const { payload, protectedHeader } = await jwtDecrypt(
    value,
    key("credentials"),
    {
      issuer: "gorth:credentials",
      audience: "fixture-web:credentials",
    }
  )
  expect(protectedHeader.typ).toBe("gorth-auth+jwe")
  expect(payload.data).toEqual(data)
  expect(await openAuthData(value, "credentials")).toEqual(data)
  await expect(openAuthData(value, "transaction")).rejects.toMatchObject({
    code: "rejected",
  })
})

it("preserves existing authenticated legacy DB credentials during migration", async () => {
  const data = { subject: "old-subject", accessToken: "old-private-token" }
  const value = await new EncryptJWT(data)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuer("https://website.test")
    .setAudience("fixture-web:credentials")
    .setIssuedAt()
    .setExpirationTime("1m")
    .encrypt(key("credentials"))
  expect(await openAuthData(value, "credentials")).toMatchObject(data)
  await expect(openAuthData(value, "transaction")).rejects.toMatchObject({
    code: "rejected",
  })
})

it.each(["expired", "issuer", "audience", "key"])(
  "rejects invalid legacy %s without trusting decoded claims",
  async (failure) => {
    const value = await new EncryptJWT({ subject: "fixture" })
      .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
      .setIssuer(
        failure === "issuer" ? "https://wrong.test" : "https://website.test"
      )
      .setAudience(
        failure === "audience" ? "wrong-client" : "fixture-web:credentials"
      )
      .setIssuedAt()
      .setExpirationTime(
        failure === "expired" ? Math.floor(Date.now() / 1000) - 1 : "1m"
      )
      .encrypt(failure === "key" ? new Uint8Array(32) : key("credentials"))
    await expect(openAuthData(value, "credentials")).rejects.toMatchObject({
      code: "rejected",
    })
  }
)
