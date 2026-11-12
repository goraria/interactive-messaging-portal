import "server-only"
import { and, eq, gt, gte, isNull, lte, or, sql } from "drizzle-orm"
import { createRemoteJWKSet } from "@gorth-io/structure/cores/jose"
import {
  AuthError,
  createLogoutVerifier,
  type VerifiedLogout,
} from "@gorth-io/structure/modules/auth/server"
import { getAuthConfig } from "@/lib/auth/config"
import { getDatabase } from "@/database"
import { revocationTable, sessionTable, userTable } from "@/database/auth"

let verifier: ReturnType<typeof createLogoutVerifier> | undefined
export async function verifyBackchannelLogoutToken(token: string) {
  if (!verifier) {
    const config = getAuthConfig()
    const key = createRemoteJWKSet(new URL("/auth/jwks", config.ssoOrigin))
    verifier = createLogoutVerifier({
      issuer: config.issuer,
      clientId: config.clientId,
      requireSid: false,
      getVerificationKey: async () => key,
      storage: { apply: endSsoSessions, isRevoked: isSsoSessionRevoked },
    })
  }
  return verifier.verify(token)
}
// Thin RP event adapter: protocol sessions remain owned by Better Auth.
export async function endSsoSessions(logout: VerifiedLogout) {
  if (!logout.sid && !logout.subject) throw new AuthError("rejected")
  const subject = logout.subject
    ? sql`${sessionTable.userId} IN
    (SELECT ${userTable.id} FROM ${userTable} WHERE ${userTable.externalUserId} = ${logout.subject})`
    : undefined
  const filter = logout.sid
    ? and(eq(sessionTable.ssoSessionId, logout.sid), subject)
    : and(
        subject,
        lte(sessionTable.createdAt, new Date(logout.issuedAt + 1000))
      )
  if (!filter) throw new AuthError("rejected")
  return getDatabase().transaction(async (transaction) => {
    const receipt = await transaction
      .insert(revocationTable)
      .values({
        jti: logout.jti,
        sid: logout.sid ?? null,
        subject: logout.subject ?? null,
        expiresAt: new Date(logout.revokeUntil),
        createdAt: new Date(logout.issuedAt),
      })
      .onConflictDoNothing()
      .returning({ id: revocationTable.jti })
    if (!receipt.length) return false
    await transaction.delete(sessionTable).where(filter)
    return true
  })
}
export async function isSsoSessionRevoked(input: {
  subject: string
  sid?: string
  issuedAt: number
  now: number
}) {
  const [receipt] = await getDatabase()
    .select({ id: revocationTable.jti })
    .from(revocationTable)
    .where(
      and(
        gt(revocationTable.expiresAt, new Date(input.now)),
        or(
          input.sid
            ? and(
                eq(revocationTable.sid, input.sid),
                or(
                  isNull(revocationTable.subject),
                  eq(revocationTable.subject, input.subject)
                )
              )
            : undefined,
          and(
            isNull(revocationTable.sid),
            eq(revocationTable.subject, input.subject),
            // receipt + 1s >= session creation; typed comparison applies the
            // timestamp encoder instead of binding a raw Date to postgres-js.
            gte(revocationTable.createdAt, new Date(input.issuedAt - 1000))
          )
        )
      )
    )
    .limit(1)
  return Boolean(receipt)
}
