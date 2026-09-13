import { v4 } from "@gorth/structure/cores/uuid"
import type { SsoExchangeResponse } from "@/lib/utils/interface"

const AUTH_CODE_TTL_MS = 60 * 1000

type AuthorizationCodeRecord = {
  payload: SsoExchangeResponse
  expiresAt: number
}

const globalStore = globalThis as typeof globalThis & {
  __ssoAuthorizationCodes?: Map<string, AuthorizationCodeRecord>
}

const authorizationCodes =
  globalStore.__ssoAuthorizationCodes ??
  new Map<string, AuthorizationCodeRecord>()

globalStore.__ssoAuthorizationCodes = authorizationCodes

function pruneExpiredAuthorizationCodes() {
  const now = Date.now()

  for (const [code, record] of authorizationCodes) {
    if (record.expiresAt <= now) {
      authorizationCodes.delete(code)
    }
  }
}

export function createAuthorizationCode(payload: SsoExchangeResponse) {
  pruneExpiredAuthorizationCodes()

  const code = v4()
  authorizationCodes.set(code, {
    payload,
    expiresAt: Date.now() + AUTH_CODE_TTL_MS,
  })

  return code
}

export function consumeAuthorizationCode(code: string) {
  pruneExpiredAuthorizationCodes()

  const record = authorizationCodes.get(code)
  authorizationCodes.delete(code)

  if (!record || record.expiresAt <= Date.now()) {
    return null
  }

  return record.payload
}
