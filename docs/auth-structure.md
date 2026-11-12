# Chat authentication — Better Auth 1.7.7

Updated 2026-10-11. This is the current contract; earlier pilot, split-Hono and
fullstack migration notes describe historical implementations.

## Ownership and flow

Gorth SSO is the identity authority and official OAuth Provider. Chat is an
OIDC relying party using Better Auth's official Generic OAuth plugin, Drizzle
adapter, database sessions and React client. Chat does not offer a second
password login or implement its own OAuth/session engine.

```text
Browser → native signIn.social("gorth") → SSO account chooser
        ← /auth/callback/gorth ← authorization code
Chat Better Auth → verified provider identity → account + local session
Browser → same-origin Hono API → native session + resource authorization
Browser → same-origin platform route → native session → owning platform service
```

PKCE, state, nonce, discovery, ID-token verification, callback handling,
provider-token encryption and refresh are owned by Better Auth. The app supplies
provider configuration, verified-profile mapping, local policy and signed logout
event integration. There is no signed HMAC BFF RPC, retired custom transaction
store or raw access/refresh-token cookie.

- `lib/auth/provider.ts`: Generic OAuth, verified SSO `sub`, fixed scopes and
  configured resource indicators; `prompt=select_account` on every login.
- `lib/auth/server/index.ts`: native auth, Drizzle models, local status checks,
  account/session SID binding and isolated host-only cookies.
- `lib/auth/browser.ts`: official React client; no periodic auth polling.
- `services/client/auth.ts`: existing UI facade over native SDK calls.
- `routes/auth.ts`: forwards original GET/POST requests to `auth.handler`.
  Next Node-runtime route bridges mount the same Hono application.
- `services/session.ts`: database-authoritative identity, server-only native
  `getAccessToken`, JWT subject/SID binding, live freshness and logout race fence.
- `services/revocation.ts`: verified SSO backchannel events invalidate native
  sessions and record durable revocation; local sign-out does not write a
  central revocation marker.
- `lib/auth/dal.ts`: direct server session lookup, React request memoization;
  no HTTP self-fetch. `proxy.ts` checks only cookie presence for navigation,
  never as final authorization.

Native endpoint paths are `/auth/sign-in/social`, `/auth/callback/gorth`,
`/auth/get-session` and `/auth/sign-out`. `/auth/sign-in` is an exact UI page,
not an optional catch-all that would intercept SDK POST requests.
The old `/auth/start`, `/auth/exchange`, `/auth/me` and `/auth/session` contract
is retired. Domain callers and fetchers are unchanged.

## Security and shared services

Identity is linked by immutable SSO `sub` (`user.external_user_id` and
`account.account_id`), not email or an application's UUID. Existing Chat UUIDs,
membership references and local roles remain intact. Native linking is disabled;
an existing email belonging to another subject cannot silently merge accounts.
SSO profile mapping cannot write Chat local permissions.

Cookie-protected mutations still validate app Origin. Better Auth owns its own
CSRF/origin protections; the separate Hono sync-user/domain routes retain theirs.
External bearer/DPoP requests and signed backchannel events authenticate
independently of app cookies. Tokens are not exposed by HTTP token-export,
account-info or refresh endpoints; native token retrieval is server-only.

API authorization still verifies access-token signature, issuer, expiry,
audience, scopes, revocation and local permissions. ID tokens are not API bearer
tokens. Notify, Resource, Discovery, Payment, Billing, Media and Insight each
receive an access token carrying their configured audience and enforce their own
scopes, identity/status and authorization. Same-origin forwarding goes directly
to the owning platform service; it never forwards the Chat session cookie.

Routine identity checks have a maximum 120-second freshness window. Sensitive
cookie-authenticated operations perform a live SSO check. Signed events bypass
that window through database revocation. SSO/DB outages fail closed without
erasing the stored app session. A session/revocation recheck fences logout
during token refresh or live verification. Service UserInfo checks are not
automatically eliminated by Chat's local session cache.

Local `signOut` deletes the Chat session and clears its cookies without
redirecting to SSO end-session (`disableProviderLogout: true`). Subsequent app
proxy requests require a live native session. This is not global logout or
proof that an already issued bearer token was remotely revoked; its holders
remain subject to the destination service's revocation and expiry policies.

## Configuration and rollout

Use root `.env.example`; private env files were not read, copied or rewritten.
`NEXT_SESSION_SECRET` now configures native Better Auth encryption/signing;
retain its existing secret value. Origins/client ID and the seven independent
`NEXT_OAUTH_*_AUDIENCE` settings remain app-owned. No new BFF secret is required.

Cloud migration was applied with `pnpm db:migrate-auth`:

- Existing custom session/verification tables were renamed to `legacy_session`
  and `legacy_verification`, not deleted.
- Native `session`, `account`, `verification` and missing auth fields were added.
- Every existing user was backfilled to a `gorth` account using their SSO sub.
- Both existing user IDs and all chat-domain row counts were verified unchanged.
- Existing Hono rate-limit rows were retained and given native row IDs.
- Only Chat's registered OAuth callbacks in the SSO DB were changed to
  `/auth/callback/gorth`; all other registration fields were verified unchanged.

Restart Chat after deploying the source. Previous custom app sessions require
one fresh login; the central SSO session and other applications are not logged
out. Archive tables and `pkg` are retained for recovery. Do not delete them with
an unattended Drizzle push; generate and inspect later migrations explicitly.

## Verification

63 Vitest tests pass across 13 files. Coverage includes native PKCE/state/nonce,
ID-token signatures, mandatory account selection, repeated resource audiences,
subject isolation, local-only sign-out, CSRF, native session binding, refresh/
logout races, bearer authorization and unchanged caller/fetcher source.
TypeScript and ESLint pass.

Default Next/Turbopack build was attempted normally and with elevated execution.
Both attempts were blocked by the execution environment's PostCSS worker port
restriction (`Operation not permitted`). No Webpack fallback or config bypass
was added. A successful production build and manual live SSO/browser round trip
still need validation outside that restriction; fixture tests do not certify
production latency or a real user's interactive login.

## Official references

- [Generic OAuth](https://better-auth.com/docs/plugins/generic-oauth): native
  `signIn.social`, callback, verified OIDC profile and local-only provider logout.
- [Hono integration](https://better-auth.com/docs/integrations/hono): mounting
  the native handler without replacing auth semantics.
- [Next.js integration](https://better-auth.com/docs/integrations/next): official
  React client, server session reads and optimistic cookie-only navigation.
- [Session management](https://better-auth.com/docs/concepts/session-management):
  native database sessions and cookie caching.
- [OAuth Provider](https://better-auth.com/docs/plugins/oauth-provider): central
  SSO, account selection and independently protected resource APIs.

Username, CIMD, enterprise SSO and Infrastructure plugins are not required for
this relying-party migration. They remain provider/application capabilities,
not dependencies installed merely because they appear in the documentation.
