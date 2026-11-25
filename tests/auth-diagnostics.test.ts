import { afterEach, expect, it, vi } from "vitest"
import { APIError } from "better-auth"
import { logAuthFailure } from "@/utils/auth-diagnostics"

afterEach(() => vi.restoreAllMocks())
it("logs only the stage, safe codes and status; never errors, tokens, headers or SQL", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {})
  const error = new APIError("BAD_REQUEST", {
    code: "PROVIDER_NOT_SUPPORTED",
    message: "Bearer private-access; database private-url",
  })
  logAuthFailure(error, "provider-token")
  expect(log).toHaveBeenCalledWith("[auth/session]", {
    stage: "provider-token",
    code: "PROVIDER_NOT_SUPPORTED",
    databaseCode: undefined,
    status: 400,
  })
  logAuthFailure(
    new Error("private SQL and password", {
      cause: { code: "42P01", query: "private SQL" },
    }),
    "revocation"
  )
  expect(log.mock.calls.at(-1)?.[1]).toMatchObject({
    stage: "revocation",
    databaseCode: "42P01",
  })
  logAuthFailure(
    { code: "private/password", cause: { code: "https://private-host/token" } },
    "identity-sync"
  )
  expect(log.mock.calls.at(-1)?.[1]).toMatchObject({
    code: undefined,
    databaseCode: undefined,
  })
  expect(JSON.stringify(log.mock.calls)).not.toMatch(
    /private|password|Bearer|SQL/
  )
})
