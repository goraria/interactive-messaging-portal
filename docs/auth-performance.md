# Chat auth performance

> Historical performance notes. Current auth uses native Better Auth, not the
> custom session/refresh engine described below. See
> [auth-structure.md](auth-structure.md) for current behavior and verification.

Historical architecture: [Hono-owned auth](auth-hono.md), updated 2026-10-11.
The signed BFF described in the historical bottleneck list below is retired.

## Remaining bottlenecks after the first optimization

- Each ordinary app-session read previously entered a PostgreSQL advisory-lock transaction, read session/user twice, read the local user again, and queried revocation twice. Concurrent BFF requests for the same handle serialized even when no refresh was needed.
- Signed BFF replay protection used a separate transaction with cleanup and insertion for every call.
- Startup was a waterfall: public account → Chat user → conversation list. The sidebar waited for the Chat-specific profile even though the account name/avatar was already verified.
- Browser login used an in-place auth-client action for full-document OAuth navigation; that action started another `/auth/me` read immediately after `location.assign`.

## Current paths

Ordinary recent reads use one authoritative SQL snapshot of session, current local user status, and active revocation markers. Every request reads the DB; no process-wide app-session or credential cache is introduced. The encrypted record must match the handle hash, provider binding, SSO subject, relational SID, creation time and expiry.

This read-only path is used only while identity verification is less than 120 seconds old and the access token is outside the shared policy's refresh leeway. Expiring tokens, stale identity and `fresh: true` checks still use `@gorth-com/structure`'s locked session service, durable rotation checkpoints, revision checks and revocation fences. Sensitive cookie-authenticated Hono mutations request fresh identity. API audience/scope/JWT verification and local authorization remain separate and mandatory.

HMAC verification and BFF proof consumption have been removed. DPoP replay storage remains database-backed. Vertical Chat HTTP no longer takes a Next session-RPC hop before Hono; its verified session identity/local projection is reused after JWT/scope verification.

Chat user and conversations begin in parallel after account authentication; the sidebar can immediately render the verified public account while the domain profile loads. Browser login navigates directly to the app-owned start route without the leaving document's post-login session read.

SSO account selection, 120-second pending-login timeout, app-only logout, HttpOnly cookies and DB ownership in Hono are retained. Configure VITE_OAUTH_RESOURCES on Hono before deploying; no schema migration is required.

## Measuring a real login

Restart Next.js and Hono after updating. Compare a warm login using the same account and network:

1. Browser Network: `/auth/start`, `/auth/exchange`, `/auth/me`, `/proxy/chat/user/me` and `/proxy/chat/conversation`.
2. Hono `/auth/me`, reached through the same-origin HTTP rewrite, exposes `Server-Timing: auth;dur=...`. The retired `/auth/session` returns 404; no HMAC/proof timing remains. Timings contain no identifiers or credentials.
3. User and conversation requests should overlap instead of waiting for one another. Recent session reads should not generate extra SSO UserInfo calls.
4. Test logout → next proxy request, local ban, verified back-channel revocation, token refresh, sensitive mutations, and a DB/SSO outage. Errors must not restore a previously authorized session or clear cookies on a temporary outage.

Automated tests assert query counts, fallback policy, replay uniqueness and security regressions. They are not a production latency benchmark; actual improvement depends on cloud DB latency, Next.js development compilation and the shared platform services' own UserInfo requests.

## Documentation

- [Better Auth 1.7.7 OAuth resource verification](https://github.com/better-auth/better-auth/blob/v1.7.7/docs/content/docs/plugins/oauth-provider.mdx#api-server): verify JWT signature, issuer, audience, expiry and required scopes locally; keep application permissions separate.
- [Better Auth 1.7.7 session management](https://github.com/better-auth/better-auth/blob/v1.7.7/docs/content/docs/concepts/session-management.mdx): central Better Auth sessions and app-owned OAuth sessions are different stores. This change does not treat SSO cookie caching as authority for the app.

> Historical performance notes. Current auth uses native Better Auth, not the
> custom session/refresh engine described below. See
> [auth-structure.md](auth-structure.md) for current behavior and verification.
