import { expect, it } from "vitest"
import { inspectDeploymentConfiguration } from "@/utils/deployment"

function configuration() {
  const values: Record<string, string> = {
    NEXT_PUBLIC_APP_URL: "https://chat.vercel.app",
    NEXT_PUBLIC_AUTH_URL: "https://sso.vercel.app",
    NEXT_OAUTH_CLIENT_ID: "chat-production",
    NEXT_OAUTH_COOKIE_PREFIX: "gorth",
    NEXT_OAUTH_AUDIENCE: "http://localhost:3030",
    NEXT_SESSION_SECRET: "s".repeat(32),
    CRON_SECRET: "c".repeat(32),
    NEXT_OAUTH_CLIENT_SECRET: "fixture-secret",
    DATABASE_URL: "postgresql://fixture:fixture@db.example.test/chat",
    AWS_ENDPOINT_URL_S3: "https://storage.example.test",
    AWS_ACCESS_KEY_ID: "fixture-key", AWS_SECRET_ACCESS_KEY: "fixture-secret",
    AWS_REGION: "ap-southeast-1", AWS_BUCKET: "fixture-bucket",
    NEXT_CHAT_ICE_SERVERS_JSON: "[]",
  }
  for (const name of ["NOTIFY", "RESOURCE", "DISCOVERY", "PAYMENT", "BILLING", "MEDIA", "INSIGHT"])
    values[`NEXT_OAUTH_${name}_AUDIENCE`] = `https://${name.toLowerCase()}.vercel.app`
  return values
}

it("allows a stable Vercel origin and preserves a registered logical audience", () => {
  const result = inspectDeploymentConfiguration(configuration())
  expect(result.errors).toEqual([])
  expect(result.warnings).toEqual([expect.stringContaining("TURN")])
})

it.each(["http://localhost:3030", "https://chat.vercel.app/path", "https://secret@chat.vercel.app", "https://chat.vercel.app?secret=fixture"])(
  "rejects unsafe production origin %s without printing its value", (url) => {
    const result = inspectDeploymentConfiguration({ ...configuration(), NEXT_PUBLIC_APP_URL: url })
    expect(result.errors).toContain("NEXT_PUBLIC_APP_URL: invalid production origin")
    expect(JSON.stringify(result)).not.toContain(url)
  }
)

it("rejects local clients/upstreams, missing backend/storage credentials and short secrets", () => {
  const result = inspectDeploymentConfiguration({
    ...configuration(), NEXT_OAUTH_CLIENT_ID: "chat-local",
    NEXT_OAUTH_MEDIA_AUDIENCE: "http://localhost:5057",
    NEXT_OAUTH_CLIENT_SECRET: "", AWS_SECRET_ACCESS_KEY: "",
    NEXT_SESSION_SECRET: "short-secret", CRON_SECRET: "short-cron",
  })
  expect(result.errors).toEqual(expect.arrayContaining([
    expect.stringContaining("NEXT_OAUTH_CLIENT_ID"),
    expect.stringContaining("NEXT_OAUTH_MEDIA_AUDIENCE"),
    expect.stringContaining("NEXT_OAUTH_CLIENT_SECRET"),
    expect.stringContaining("AWS_SECRET_ACCESS_KEY"),
    expect.stringContaining("NEXT_SESSION_SECRET"),
    expect.stringContaining("CRON_SECRET"),
  ]))
  expect(JSON.stringify(result)).not.toMatch(/short-secret|short-cron/)
})

it("distinguishes an unconfigured relay from malformed ICE and a configured relay", () => {
  const values = configuration()
  values.NEXT_CHAT_ICE_SERVERS_JSON = '{"urls":"turn:relay"}'
  expect(inspectDeploymentConfiguration(values).errors).toContain("NEXT_CHAT_ICE_SERVERS_JSON: invalid ICE configuration")
  values.NEXT_CHAT_ICE_SERVERS_JSON = JSON.stringify([{ urls: "turns:relay.example.test:5349", username: "fixture", credential: "fixture" }])
  expect(inspectDeploymentConfiguration(values)).toEqual({ errors: [], warnings: [] })
})
