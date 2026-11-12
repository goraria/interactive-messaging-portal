import {
  AuthError,
  createAuthPolicy,
  createOAuthProvider,
  createOidcDiscovery,
  createSessionBoundTransport,
  createSessionService,
  createLogoutVerifier,
  fingerprintAuthValue,
  type AuthTransport,
} from "@gorth/structure/modules/auth/server"
import { createAuthStore } from "@/lib/auth/store"
import { getAuthConfig } from "@/lib/auth/config"
import { sealAuthData, openAuthData } from "@/lib/auth/config"
import { sessionMaxAgeSeconds } from "@/utils/environment"
const getSessionMaxAge = () => Number(sessionMaxAgeSeconds || 2592000)
import { databaseUrl, nodeEnv } from "@/utils/environment"
import axios from "@gorth/structure/cores/axios"
import { createFetcher } from "@gorth/structure/modules/http"
import { getSsoUserInfo, forgetSsoUserInfo } from "@/services/sso-userinfo"
const fetcher = createFetcher(axios)

let sharedStore: ReturnType<typeof createAuthStore> | undefined
function initialize() {
  const config = getAuthConfig()
  if (!databaseUrl) throw new AuthError("invalid_configuration")
  const age = getSessionMaxAge() * 1000
  const policy = createAuthPolicy({
    transactionMaxAgeMs: 120_000,
    identityMaxAgeMs: 120_000,
    sessionMaxAgeMs: age,
    revocationRetentionMs: age + 60_000,
  })
  const store = (sharedStore ??= createAuthStore({
    databaseUrl,
    seal: (value, expiresAt) => sealAuthData(value, "credentials", expiresAt),
    open: (value) => openAuthData(value, "credentials"),
  }))

  const transport: AuthTransport = {
    async request(url, options) {
      if (url === config.serverOrigin + "/auth/oauth2/userinfo") {
        // Login and an explicit session freshness check must contact SSO.
        // Seed the same identity cache used by subsequent read-only APIs.
        const authorization =
          new Headers(options.headers).get("authorization") ?? ""
        if (!authorization.startsWith("Bearer "))
          throw new AuthError("rejected")
        try {
          return {
            status: 200,
            data: await getSsoUserInfo(authorization.slice(7), { fresh: true }),
          }
        } catch (error) {
          // An inactive central account invalidates this app identity. Core
          // removes rejected sessions; temporary SSO outages must not do so.
          if (error instanceof AuthError && error.code === "forbidden")
            throw new AuthError("rejected")
          throw error
        }
      }
      try {
        const response = await fetcher<unknown>({
          url,
          method: options.method,
          headers: { ...options.headers },
          body: options.body,
          signal: options.signal,
          timeout: 10_000,
          maxContentLength: 1024 * 1024,
          maxBodyLength: 65536,
          redirect: "error",
          cache: "no-store",
          validateStatus: () => true,
        })
        return { status: response.status, data: response.data }
      } finally {
        if (
          url === config.serverOrigin + "/auth/oauth2/revoke" &&
          options.body instanceof URLSearchParams &&
          options.body.get("token_type_hint") === "access_token"
        ) {
          const token = options.body.get("token")
          if (token) await forgetSsoUserInfo(token)
        }
      }
    },
  }
  const discovery = createOidcDiscovery({
    issuer: config.issuer,
    endpointOrigins: [config.ssoOrigin, config.serverOrigin],
    allowedPath: (url) => url.pathname.startsWith("/auth/"),
    allowLoopbackHttp: nodeEnv !== "production",
    transport,
    cacheMaxAgeMs: 120_000,
  })
  // Cache/coalescing is owned by Structure, not repeated for every grant.
  const getVerificationKey = () => discovery.getVerificationKey()
  const provider = createOAuthProvider({
    config: {
      issuer: config.issuer,
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      postLogoutRedirectUri: config.origin,
      endpointOrigins: [config.ssoOrigin, config.serverOrigin],
      scopes: config.scopes,
      resources: config.resources,
      allowLoopbackHttp: nodeEnv !== "production",
      endpoints: {
        authorization: config.ssoOrigin + "/auth/oauth2/authorize",
        token: config.serverOrigin + "/auth/oauth2/token",
        userinfo: config.serverOrigin + "/auth/oauth2/userinfo",
        revocation: config.serverOrigin + "/auth/oauth2/revoke",
        endSession: config.ssoOrigin + "/auth/oauth2/end-session",
      },
    },
    transport: createSessionBoundTransport(transport, {
      issuer: config.issuer,
      clientId: config.clientId,
      tokenUrl: config.serverOrigin + "/auth/oauth2/token",
      revocationUrl: config.serverOrigin + "/auth/oauth2/revoke",
      endpointOrigins: [config.ssoOrigin, config.serverOrigin],
      allowLoopbackHttp: nodeEnv !== "production",
      key: discovery.currentVerificationKey,
    }),
    getVerificationKey,
    loginStorage: store.login,
    policy,
  })
  const sessions = createSessionService({
    provider,
    storage: store.storage,
    revocation: store.revocation,
    identity: store.identity,
    policy,
  })
  const logout = createLogoutVerifier({
    issuer: config.issuer,
    clientId: config.clientId,
    getVerificationKey,
    storage: store.revocation,
    policy,
  })
  async function credentials(handle: string, fresh = false) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(handle)) return null
    try {
      if (!fresh) {
        const current = await store.readCurrentCredentials(
          await fingerprintAuthValue(handle),
          provider.binding,
          policy
        )
        if (current !== undefined) return current
      }
      // Stale identity, expiring tokens and explicit sensitive checks retain
      // core's cross-process lock, refresh checkpoint and revocation fences.
      return await sessions.credentials(handle, { fresh })
    } catch (error) {
      if (error instanceof AuthError) throw error
      throw new AuthError("unavailable")
    }
  }
  async function signOut(handle: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(handle)) return { remoteRevoked: true }
    const key = await fingerprintAuthValue(handle)
    return store.storage.withLock(key, async () => {
      const record = await store.storage.read(key)
      // Remove this app handle before remote revocation, under its refresh lock.
      // A live central SID remains usable for a later login; only verified SSO
      // logout events may create SID-wide revocation markers.
      await store.storage.remove(key)
      if (!record) return { remoteRevoked: true }
      try {
        await provider.revoke(record.credentials)
        return { remoteRevoked: true }
      } catch {
        return { remoteRevoked: false }
      }
    })
  }
  return {
    store,
    provider,
    sessions,
    logout,
    credentials,
    signOut,
    policy,
    discovery,
  }
}
let runtime: ReturnType<typeof initialize> | undefined
export function getAuthRuntime() {
  return (runtime ??= initialize())
}
