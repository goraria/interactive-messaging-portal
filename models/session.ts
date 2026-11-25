import { oauthCookiePrefix } from "@/utils/environment";
import "server-only";
import { getSessionCookie } from "better-auth/cookies";
import { and, eq } from "drizzle-orm";
import {
  AuthError,
  assertTokenContinuity,
} from "@gorth-com/structure/modules/auth/server";
import {
  requestToResourceInput,
  verifyAccessTokenRequest,
} from "better-auth/oauth2";
import { authServer } from "@/lib/auth/server";
import { getAuthConfig } from "@/lib/auth/config";
import { getDatabase } from "@/database";
import { accountTable, sessionTable, userTable } from "@/database/auth";
import { rawIsSsoSessionRevoked } from "@/models/revocation";
import { rawGetSsoUserInfo } from "@/services/sso-userinfo";
import { oauthAudience } from "@/utils/environment";
import type { AppSessionCredentials } from "@/utils/interface";
import { logAuthFailure } from "@/utils/auth-diagnostics";
import { isLocalUserActive, isIdentityStale } from "@/utils/server/auth";
import { measureRequest } from "@/utils/server/timing";

export async function rawReadAppIdentity(incoming: Headers) {
  let stage = "native-session";
  try {
    if (!getSessionCookie(incoming, { cookiePrefix: oauthCookiePrefix }))
      return null;
    const session = await measureRequest("session", () =>
      authServer.api.getSession({
        headers: incoming,
        query: { disableCookieCache: true },
      }),
    );
    if (!session) return null;
    stage = "local-user";
    const [user] = await measureRequest("identity_db", async () =>
      getDatabase()
        .select()
        .from(userTable)
        .where(eq(userTable.id, session.user.id))
        .limit(1),
    );
    if (!user || !isLocalUserActive(user) || !session.session.ssoSessionId)
      return null;
    const sid = session.session.ssoSessionId;
    stage = "revocation";
    if (
      await measureRequest("revocation", () =>
        rawIsSsoSessionRevoked({
          subject: user.externalUserId,
          sid,
          issuedAt: session.session.createdAt.getTime(),
          now: Date.now(),
        }),
      )
    )
      return null;
    return {
      user,
      subject: user.externalUserId,
      sid,
      id: session.session.id,
      createdAt: session.session.createdAt.getTime(),
      expiresAt: session.session.expiresAt.getTime(),
    };
  } catch (error) {
    logAuthFailure(error, stage);
    throw error;
  }
}
export async function rawReadAppCredentials(
  incoming: Headers,
  fresh = false,
): Promise<AppSessionCredentials | null> {
  const identity = await rawReadAppIdentity(incoming);
  if (!identity) return null;
  return readIdentityCredentials(incoming, identity, fresh);
}

// Keep the verified identity request-local. Refresh never repeats getSession,
// the local user query or the initial revocation lookup.
export async function rawReadAuthenticatedIdentity(
  incoming: Headers,
  fresh = false,
) {
  const identity = await rawReadAppIdentity(incoming);
  if (!identity) return null;
  if (fresh || isIdentityStale(identity.user))
    return readIdentityCredentials(incoming, identity, true);
  return identity;
}

async function readIdentityCredentials(
  incoming: Headers,
  identity: NonNullable<Awaited<ReturnType<typeof rawReadAppIdentity>>>,
  fresh: boolean,
): Promise<AppSessionCredentials | null> {
  let stage = "provider-account";
  try {
    const [account] = await getDatabase()
      .select({ id: accountTable.id })
      .from(accountTable)
      .where(
        and(
          eq(accountTable.userId, identity.user.id),
          eq(accountTable.providerId, "gorth"),
        ),
      )
      .limit(1);
    if (!account) return null;
    const config = getAuthConfig();
    stage = "provider-token";
    const token = await authServer.api.getAccessToken({
      headers: incoming,
      body: { accountId: account.id },
    });
    const input = requestToResourceInput(new Request(config.origin + "/auth"));
    input.authorizationHeader = "Bearer " + token.accessToken;
    stage = "access-token-verification";
    const claims = await verifyAccessTokenRequest(input, {
      jwksUrl: new URL("/auth/jwks", config.ssoOrigin).href,
      verifyOptions: {
        issuer: config.issuer,
        audience: new URL(oauthAudience).origin,
        typ: "at+jwt",
        algorithms: ["RS256", "ES256", "EdDSA"],
        requiredClaims: ["iss", "aud", "sub", "iat", "exp"],
      },
    });
    assertTokenContinuity(claims, identity);
    if (fresh || isIdentityStale(identity.user)) {
      stage = "sso-userinfo";
      const profile = await rawGetSsoUserInfo(token.accessToken, {
        fresh: true,
      });
      if (profile.sub !== identity.subject) throw new AuthError("rejected");
      stage = "identity-sync";
      await getDatabase()
        .update(userTable)
        .set({ syncedAt: new Date() })
        .where(eq(userTable.id, identity.user.id));
    }
    // Fence logout/revocation that raced the provider refresh or live check.
    stage = "session-fence";
    const [current] = await getDatabase()
      .select({ id: sessionTable.id })
      .from(sessionTable)
      .where(
        and(
          eq(sessionTable.id, identity.id),
          eq(sessionTable.userId, identity.user.id),
        ),
      )
      .limit(1);
    if (
      !current ||
      (await rawIsSsoSessionRevoked({
        subject: identity.subject,
        sid: identity.sid,
        issuedAt: identity.createdAt,
        now: Date.now(),
      }))
    )
      return null;
    return { ...identity, credentials: { accessToken: token.accessToken } };
  } catch (error) {
    logAuthFailure(error, stage);
    throw error;
  }
}
