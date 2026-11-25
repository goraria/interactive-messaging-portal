# Gorth authentication pilot

> Chat's signed-BFF implementation and setup notes below are historical and
> superseded by the root [native Better Auth application](auth-structure.md).
> Do not configure BFF secrets or invoke the retired RPC for the current Chat app.
> The other applications' historical notes are not changed by this Chat migration.

## Scope and status

This phase adapts Browser Website, Launcher Website, Chat, Gorth Browser and Gorth Launcher to the published `@gorth-com/structure` auth contract. Video, Reader, Social, Task and Marketplace are not migrated in this phase. The seven shared services are inspected for compatibility, not changed.

Gorth SSO remains the only identity authority. This work does not install a second Better Auth server in an application, modify the published package, push database schemas, or register production OAuth clients.

The automated checks use signed-token fixtures and mocked infrastructure. They do not establish that production registration, live PostgreSQL coordination, native cookie persistence or an end-to-end SSO login has been verified.

## Boundaries

| Application                | Session authority and storage                       | Browser-facing layer                                                                       |
| -------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Browser / Launcher Website | Server-only Next.js runtime, application PostgreSQL | Next.js route handlers; public session only                                                |
| Chat                       | Hono server, application PostgreSQL                 | Next.js BFF calls the signed internal Hono endpoint; no DB connection or DB URL in Next.js |
| Browser / Launcher desktop | Electron main process, encrypted vault              | Renderer receives a public snapshot, never OAuth credentials                               |

Shared modules own OAuth/PKCE, session coordination contracts, logout verification, resource policy and the public auth client. Each app supplies configuration and a storage adapter. Application environment loading and database connections remain outside the package.

Client-side API operations use `caller`; the BFF and OAuth provider transports use `fetcher` / Axios for upstream calls. Chat's private `/auth/session` endpoint is POST-only, bounded and authenticated using a timestamped HMAC over method, path and exact body. Nonces are consumed persistently to reject replay. It does not authenticate using the user's cookies.

## Required configuration before live testing

1. Set the **same new, private, random secret of at least 32 bytes** as `NEXT_BFF_SECRET` in Chat/client and `VITE_BFF_SECRET` in Chat/server, both locally and in deployment. The examples contain declarations, not a working secret. These values are server-only despite the project's existing `NEXT_` / `VITE_` naming conventions. Do not expose them through client bundler definitions. Both environment modules export `bffSecret`; no legacy name or fallback to an application encryption key is accepted.
2. Keep Chat's `DATABASE_URL` only in Hono/server. The BFF has no database adapter. Keep the existing application encryption keys stable; changing them invalidates encrypted sessions.
3. Verify the SSO registrations: exact callback URI, registered post-logout redirect, allowed resource audiences/scopes and backchannel URI. Website development ports are **5503** and **5504**; Chat/client is **3030**, Chat/server **5050**. Production callbacks and backchannels must be reachable HTTPS endpoints, not development localhost addresses.
4. Interactive clients must issue a signed ID token with a central session `sid` (enable end-session/backchannel support in the SSO client registration). This is checked on login and refresh. Missing `sid` fails closed rather than creating a detached interactive session.
   The existing native-client seeds had `enable_end_session: false`. They are corrected to `true`, and SSO's explicit `db:seed:desktop-clients` command upgrades this flag only after checking the existing PKCE/public/callback/scope configuration. On 2026-10-09, with explicit administrator approval, `pnpm run db:seed:desktop-clients --session-binding-only` successfully applied and verified `enableEndSession: true` for `gorth-browser` and `gorth-launcher` in the configured SSO database. The transaction checks that secrets, callbacks, scopes and protected client metadata are unchanged; update-only mode refuses to create missing clients. Native callbacks remain localhost:5501/auth/callback and localhost:5502/auth/callback. This verifies registration data, not a live end-to-end login. Previously issued ID tokens do not gain a SID retroactively; sign in again to obtain session-bound credentials. The command is never run implicitly at startup.
5. Application and SSO origins must agree with deployment configuration. Mutation handlers reject absent or foreign Origin headers. Check reverse-proxy request URLs and forwarded-origin handling without weakening this check.

The common host-only cookie names, including `gorth.session_app`, are intentional. **Cookies are not isolated by port**: localhost:5503, localhost:5504 and localhost:3030 can overwrite a same-name cookie in one browser profile. For simultaneous local testing, use isolated profiles or distinct registered local hostnames; do not treat the shared cookie name as a shared application session.

Old custom session payloads and desktop vault entries without the required nonce/session binding may require one fresh login. Application user data is retained. No destructive data migration is performed here.

## Session lifecycle and revocation

- Login uses authorization code, PKCE S256, state and nonce. A persistent one-use receipt prevents reuse of the callback transaction. The shared provider verifies issuer, client audience, signature, token hashes and subject binding.
- Web application session handles are opaque and hashed in the database. OAuth credentials and private session records are encrypted. Browser JSON exposes only the selected user DTO and expiry, not access/refresh/ID tokens.
- Storage uses the existing singular `user`, `session`, `verification`, `revocation` and `proof` tables. Identity linking uses the SSO `sub` / external user ID, never an email-only match. Existing local role, status and ban/deletion controls remain authoritative.
- Chat administration now requires the current local DB role `admin`; central `app.role` / `roles` / `permissions` claims alone do not grant administration. Existing administrators must have the intended local role provisioned through a controlled administrative process. A normal profile PATCH cannot rebind `external_user_id`, change role/status, or clear a ban/deletion flag.
- Refresh is coordinated with a PostgreSQL advisory lock across instances. A rotated credential checkpoint is committed before a subsequent UserInfo call can fail. Session replacement is revision-checked, and revocation is fenced against insertion/replacement; an in-flight refresh cannot resurrect a deleted session.
- Signed backchannel logout is verified before persistent revocation and session deletion. Markers remain for the application session lifetime plus skew, not merely the short lifetime of the logout JWT. Repeated delivery is safe.
- Reads verify central SSO when required; sensitive mutations perform a fresh central check, and Chat's receiving API verifies centrally on each protected request. The BFF also checks the application session before every proxy call. A temporary upstream failure is reported as unavailable and does not silently erase a healthy browser session cookie.
- The application additionally requires signed `sid` binding on refreshed interactive credentials. Better Auth's `offline_access` refresh grant can survive central browser logout; rejecting a SID-less refreshed grant prevents it from silently restoring an interactive session after a missed logout event.

## What logout does and does not prove

Browser Website and Launcher Website now use **app-only logout**. Both `DELETE /auth/me` and the account form's `POST /auth/sign-out` delete the current app handle under its refresh lock before attempting revocation of that app's OAuth grant. They do not revoke the central SID, clear SSO cookies or navigate to `end-session`; the browser reloads the app home page. The same live SSO session remains usable for a new app login. Verified backchannel logout still applies central revocation separately. Chat's pilot logout behavior is unchanged by this website-specific change.

Subsequent app proxy requests with the deleted handle are rejected. A remote grant-revocation failure does not revive the local session. `X-Gorth-Revocation: pending` means remote token revocation was not confirmed, not that logout succeeded everywhere. Durable DB deletion failure returns unavailable and does not falsely acknowledge successful logout.

Desktop logout durably clears the local vault first, then attempts grant revocation and SSO sign-out using the embedded login cookie jar. Cookies are cleared only after a successful JSON acknowledgement. If the jar has no central cookie, that response alone is not proof that an older central session was ended. Desktop identity is rechecked on unlock and periodically; credentials with missing nonce/SID require login.

In the inspected Better Auth OAuth provider, refresh-token revocation does **not** by itself invalidate an already-issued signed access JWT. Direct holders of such a token can remain valid until expiry unless the receiving API enforces central-session checks or a revocation marker. The configured SSO access-token lifetime is currently ten minutes. Applications must not describe local deletion, grant revocation or an end-session redirect as guaranteed global logout. Backchannel events and direct SSO checks provide the complementary enforcement.

## Seven shared-service invariants

1. APIs receive an **access token**, with their own resource audience and required scope. An ID token is never substituted. BFF resource indicators preserve the configured downstream origins; the receiving service still validates its own policy.
2. Cross-service identity is SSO `sub`. A website's local UUID may still be used for its own business-table foreign keys, not as another service's identity.
3. Chat's proxy route families authorize the app handle before forwarding. This includes the existing `/proxy/chat/*` caller URLs: their direct external rewrite is removed and replaced with an authenticated route using the same BFF guard. Cleared, revoked, expired or locally blocked sessions cannot use token compatibility cookies to bypass the BFF.
4. Webhooks, worker jobs and machine credentials retain their independent authentication mechanism. No user-cookie dependency is introduced.
5. A cached application session does not eliminate the services' own UserInfo calls. Chat's API still verifies centrally; a per-request memo avoids only duplicate checks inside the same request.

Service-specific permissions and client registrations must be tested with the real service audiences; this phase neither grants new scopes nor relaxes existing resource policies.

## Automated verification

From Chat/server:

```sh
pnpm exec tsc --noEmit --incremental false
pnpm exec tsc --noEmit --incremental false --project tests/bff.tsconfig.json
pnpm test:auth
pnpm test:website
```

From each desktop app:

```sh
pnpm exec tsc --noEmit
pnpm test:auth
```

The auth suites cover HMAC body/path/time binding and replay, wrong audience/scope, signed logout, rotation checkpointing, concurrent refresh and logout races, detached grants, public JSON without tokens, access-cookie-only rejection, Origin checks, unavailable-upstream cookie preservation, embedded-view isolation and logout acknowledgement ordering. Website fixture suites run from Chat/server against the actual route modules of both website roots.

Results: **39 auth tests pass** (16 Chat/Hono/BFF, 12 website, 5 Browser desktop and 6 Launcher desktop). TypeScript and targeted ESLint checks pass for the website and desktop changes and Chat/client. Chat/server's existing ESLint configuration contains only ignore declarations and does not select TypeScript files; an explicit temporary TypeScript lint configuration was used to check the changed auth modules instead of claiming the default command linted them.

Both websites build with their default Next.js command. Chat/Hono builds with Vite. Chat/client builds with `pnpm exec next build --webpack`; its default Turbopack build hits an environment restriction on an internal port bind. This fallback verification does not change the application's bundler configuration. The initial sandbox attempt also could not fetch Google Fonts; the successful Webpack build used approved network access.

## Logout gateway regression (2026-10-09)

Both website end-session requests failed at the shared SSO Next.js gateway, not at an application database. Direct requests to the Hono provider returned the confirmation page, but Axios failed decoding its gzip response with `Z_DATA_ERROR`; the gateway reported this transport exception as `sso_server_unavailable`. Requesting identity encoding returned the same HTML successfully.

SSO/client's `services/route.ts` now requests `Accept-Encoding: identity` when forwarding auth protocol routes. This avoids the failing compressed response on that transport only. It does not disable compression globally, change shared `fetcher`, weaken Origin/redirect validation, or remove the provider's confirmation cookies and CSP.

Run `pnpm test:sso` from Chat/server for five gateway regression tests against SSO/client's actual proxy and service modules. Fixtures cover both website clients, request-header isolation, manual redirects, preserved cookies/CSP/cache policy, provider rejection, genuine transport failure and confirmation redirects. These tests mock upstream transport; they are not authenticated logout tests.

Live anonymous protocol checks separately verified a `200` confirmation page and a `302` confirmation redirect to `http://localhost:5503` and `http://localhost:5504`, using only fresh anonymous confirmation cookies. Actual signed-in session deletion, token revocation and backchannel delivery still require the acceptance checks below.

### Website app-only logout follow-up

The user subsequently requested app-only logout rather than central SSO confirmation. Both website logout routes and the shared browser client adapter are updated accordingly. App-local logout no longer writes a central-SID revocation marker, which previously could block a fresh login while the central session was still alive. No SSO Origin/CSRF policy is relaxed to bypass the reported confirmation-page `INVALID_ORIGIN`; that central logout path is simply no longer part of either website's logout action.

With explicit approval, a targeted transaction removed **three** active legacy `local:<43-character handle fingerprint>:<43-character revision>` markers from Browser Website and **one** from Launcher Website. Exact counts and marker format were checked before deletion; every other revocation row was compared before/after and preserved. No user or app-domain data was changed. No separate backup of these temporary authentication markers was created.

`pnpm test:website` now passes **32 tests across both websites**. The suites exercise actual browser adapters, both route entry points, runtime app-handle deletion, re-login with the same central SID, other app handles, failure ordering, cookie isolation and unchanged central-revocation behavior. Transport/storage infrastructure remains mocked; this is not a live authenticated logout certification. Website and fixture TypeScript checks and targeted website ESLint pass.

## Live pilot acceptance checklist

### Chat login-start configuration regression (2026-10-09)

The running Chat `/auth/start` route returned `503 auth_unavailable` while Hono `/health` returned `200`. Runtime signing checks on both sides independently returned `invalid_configuration`: the internal HMAC key was missing or invalid. The application still read the old environment names after the configuration switched to `NEXT_BFF_SECRET` and `VITE_BFF_SECRET`; both environment modules and their consumers now use the configured names. The BFF failure occurs before it contacts Hono or SSO. Configure the same private random key of at least 32 bytes on both sides and restart the development processes; no default key, fallback to another secret or HMAC bypass is introduced. No private environment value was printed or copied.

The start route now logs only its stage and shared error category, never the raw exception, and marks error responses `no-store` while preserving its browser-facing error contract. Seven new fixture tests exercise invalid keys, sign-in/sign-up, signed body verification, sealed transaction cookies, independent encryption failure, safe transport-error logging and foreign-origin rejection. All **11 BFF tests** pass, including the previous four session/proxy tests; BFF-test and Chat-client TypeScript checks and targeted route ESLint pass. This does not establish a live login until the configuration requirement is satisfied.

### Chat BFF configuration and callback follow-up (2026-10-10)

Chat now reads `NEXT_BFF_SECRET` and `VITE_BFF_SECRET` through its environment modules. A private runtime challenge comparison initially found that the two configured keys differed; no key or derived signature was printed. After the owner synchronized them, live anonymous requests verified `307` from Chat `/auth/start` to SSO `/auth/oauth2/authorize` with PKCE S256, nonce and the sealed transaction cookie, followed by SSO's `302` to `/auth/sign-in`. Hono `/health` returned `200`, and an anonymous `/auth/me` returned `401` rather than granting a session.

Eight new callback fixtures cover the actual Next exchange route, signed Hono request, opaque secure session cookie, missing/tampered/expired transactions, foreign callback origin, unavailable exchange, invalid session handles and foreign return paths. The Hono signature fixture also rejects a mismatched BFF key before consuming a nonce. `pnpm test:auth` passes **31 tests** (12 Hono/shared-auth tests and 19 BFF tests). Client/server and BFF-fixture TypeScript checks, targeted client ESLint and the Hono build pass. No DB connection is added to Next.js, and no SSO or application secret is changed by this patch.

These live checks use no signed-in account. They verify login-start transport and SSO routing, not real credentials, authenticated callback completion, production refresh concurrency or end-to-end logout. Chat retains its existing central-logout behavior; the earlier app-only logout request applied to the two website samples.

### Acceptance checks

- Configure the BFF secret pair and verify SSO registrations before starting the apps.
- Complete login and account creation through central SSO, then reopen a valid app session. Confirm local role/status are not overwritten by profile synchronization.
- Reject wrong state/nonce/issuer/audience, consumed callbacks, forged backchannel JWTs and replayed internal BFF requests.
- Exercise refresh from two deployed processes sharing PostgreSQL; verify one rotation, committed checkpoint and no resurrection when logout races with refresh.
- Log out locally and centrally; confirm the next proxy/API request is rejected. Repeat with a missed backchannel event and require the next direct central check to reject the session.
- Suspend/ban/delete a local user and verify access is denied without changing the central account.
- Simulate a temporary SSO outage: protected operations fail closed with an unavailable response; no credential is logged and an otherwise valid browser cookie is not cleared indiscriminately.
- Check each shared service's audience, scope and SSO-sub identity using genuine tokens; verify workers/webhooks are unchanged.
- Validate desktop login, unlock, periodic verification and logout with Electron's real cookie jar and vault, including restart without a retained central cookie.

Do not roll the remaining five web apps onto the new mechanism until these real-system pilot checks have passed.

> Historical pilot notes. Current Chat auth and cloud rollout are documented in
> [auth-structure.md](auth-structure.md). Do not restore the retired BFF or
> custom app-session engine from these notes.
