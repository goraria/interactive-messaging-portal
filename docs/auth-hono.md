# Chat: Hono-owned authentication and sessions

> Historical intermediate split-app design. The current implementation is the
> root [native Better Auth fullstack application](auth-structure.md). Do not use
> the old VITE_* / rewrite / 5050 setup below for the current app.

Updated 2026-10-11. This document supersedes the Chat signed-BFF design in earlier pilot notes.

## Ownership

Gorth SSO remains the sole Better Auth identity authority. Chat remains its OAuth/OIDC client, using the installed public Structure auth modules. This migration does not add a second Better Auth authority or change SSO configuration.

- Hono owns PKCE/state/nonce, callback validation, opaque app-session handles, encrypted PostgreSQL credentials, refresh locks, local policy, logout and signed backchannel verification.
- Next owns UI navigation and fixed-upstream HTTP rewrites. It does not sign HMAC RPC, encrypt transactions or connect to the database.
- Existing caller URLs and caller/fetcher implementations are unchanged.

```text
Browser → Next same-origin HTTP rewrite → Hono → app DB / Gorth SSO

Resource / Notification / Discovery requests:
Browser → owning Next gateway → service directly
                            ↘ Hono /auth/me: validate app handle first
```

The shared-service check prevents an old access-token cookie from bypassing app logout. It uses the public cookie endpoint, not a privileged credential RPC. Next reads Hono's issued HttpOnly access cookie server-side and forwards the access token to the owning service; browser JavaScript receives no token JSON.

## Endpoints

| Public route                                    | Owner and behavior                                                                                                                                                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET /auth/start                                 | Hono reserves a 120-second transaction and redirects to SSO. Sign-in always uses select_account; sign-up uses create.                                                                                          |
| GET /auth/exchange                              | Hono validates the sealed transaction and Structure verifies state, nonce, issuer, audience, PKCE and single-use callback. The callback origin comes from configured app origin, never forwarded Host headers. |
| GET /auth/me                                    | Hono validates the app handle and returns only public user/session fields. A fresh=1 check requests current SSO identity.                                                                                      |
| DELETE /auth/me                                 | Hono requires app Origin, removes the local handle under its refresh lock and attempts grant revocation. It does not navigate to SSO end-session or clear SSO multi-session cookies.                           |
| POST /auth/sign-out/back-channel                | Hono verifies the signed provider event independently of app cookies and applies durable revocation.                                                                                                           |
| /auth/session                                   | Removed credential RPC; returns 404, including requests carrying legacy HMAC headers.                                                                                                                          |
| /proxy/chat/* and selected /chat/* API prefixes | HTTP rewrites to cookie-authenticated Hono APIs. /chat UI pages are not rewritten.                                                                                                                             |

Successful callback rotates the opaque app handle. Failed/cancelled login or switching preserves the previous app session. The old Next-encrypted pending transaction format is not reused: restart an in-progress login after deployment.

## Security and freshness

- Recent reads retain one current DB snapshot of session, local user status and revocation. No cross-request authorization cache is introduced.
- Identity freshness remains 120 seconds. Expiring credentials and sensitive cookie-authenticated writes use Structure's coordinated refresh/fresh identity path.
- Hono APIs still verify signature, issuer, resource audience, expiry and required scope; local permissions are independent. A verified cookie session's identity/local projection is reused rather than making a second UserInfo request.
- Raw access/refresh-token cookies never authorize Chat without a valid app handle. External bearer APIs retain their independently verified token flow.
- Mutation Origin checks and cross-site cookie-read rejection stay enabled. Credentialed CORS uses exact configured origins, including development.
- Cookies are host-only, HttpOnly and SameSite=Lax, Secure in production. OAuth transaction cookies use /auth and 120-second lifetime. The existing access/refresh cookie names are retained, but refresh authority is the encrypted DB record.
- Auth/private responses are no-store. Expired/revoked sessions are rejected; temporary DB/SSO failure returns unavailable without erasing healthy cookies or falling back to stale credentials.
- Proof storage remains for DPoP; HMAC-RPC proof receipts are no longer written. No auth tables are dropped or cloud migration performed.

Local logout fences later app/proxy requests before remote grant revocation. X-Gorth-Revocation: pending means SSO revocation was not confirmed. Direct holders of an issued access token may remain valid until the receiving service detects revocation or the token expires; pending is not a claim of global logout. Existing in-flight requests are not retroactively cancelled. Shared services retain their own JWT/scopes, revocation and UserInfo policies.

## Configuration/deployment

Keep DATABASE_URL and VITE_SESSION_SECRET only in Hono. Keep the session secret unchanged to preserve existing encrypted credentials.

NEXT_BFF_SECRET, VITE_BFF_SECRET and Next's transaction encryption secret are no longer read. Their declarations were removed from examples; this change does not inspect or rewrite private environment files.

Hono's VITE_OAUTH_RESOURCES is a whitespace-separated, backend-owned audience allowlist:

```dotenv
VITE_OAUTH_RESOURCES=http://localhost:5050 http://localhost:7073 http://localhost:7072 http://localhost:7074
```

Use exact registered HTTPS service origins in production. The Chat API resource is always included. New login grants use this fixed configuration; a browser/RPC cannot request arbitrary audiences. It must match the earlier audience order/list to retain existing provider bindings. Configure the GORTH_* cookie names identically on client/server if overriding their canonical names.

Cookies are not isolated by port: multiple local apps on localhost with the same cookie names can overwrite each other's handles. Use distinct configured local hostnames or app cookie names when testing them simultaneously; changing cookie names requires restarting login. SSO's central session and multi-session cookies remain separate and are never forwarded to Hono.

Restart the fullstack Next application after deploying configuration. Hono runs in the same application; no separate Chat backend rewrite is required. SSO uses NEXT_PUBLIC_AUTH_URL for all OAuth endpoints. At the edge, preserve method, query, Origin, app Cookie and each Set-Cookie separately; do not cache auth/private responses or trust browser-supplied forwarded hosts/IPs as authority. Production rate limiting uses the existing persistent store when RATE_LIMIT_ENABLED is configured.

## Verification

From server:

```sh
pnpm test
pnpm exec tsc --noEmit --incremental false
pnpm exec tsc --project tests/client.tsconfig.json --noEmit --incremental false
pnpm build
```

From client:

```sh
pnpm exec next typegen
pnpm exec tsc --noEmit --incremental false
pnpm build
```

The migration's fixture tests cover OAuth checks, 120-second transactions, cancellation, refresh races, local policy, logout/revocation, cookie-only API auth, bearer APIs, CSRF, public session projection, retired RPC and Next routing. They do not prove a live SSO login, real cloud coordination or production latency.

Hono build and both application/type-fixture checks passed. 89 Vitest tests passed. Default Next/Turbopack build was attempted but the execution environment denied the internal PostCSS port with Operation not permitted, including the elevated retry. Turbopack was not replaced or suppressed.

Targeted client ESLint checks passed. The current server ESLint configuration reports TypeScript files as ignored, so its exit status is not a successful source lint; server verification relies on the TypeScript/build and Vitest results above.

## Documentation basis

- [Better Auth Hono integration](https://better-auth.com/docs/integrations/hono): raw HTTP handler integration and explicit credentialed origin policy.
- [Better Auth security](https://better-auth.com/docs/reference/security): Origin/Fetch Metadata checks, secure cookies and trusted proxy boundaries.
- [OAuth provider](https://better-auth.com/docs/plugins/oauth-provider): PKCE, account selection, resource-bound access tokens and independent API verification.
- [Session management](https://better-auth.com/docs/concepts/session-management): expiry, refresh and the limits of caching for revocation.

Better Auth's central session store is distinct from this app-owned OAuth session store. Moving ownership to Hono is an application architecture choice, not a Better Auth requirement to use or remove a BFF.
