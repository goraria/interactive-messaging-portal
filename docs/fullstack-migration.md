# Chat fullstack

> Authentication sections and validation results below describe earlier migration
> stages. The current native Better Auth contract and cloud rollout are in
> [auth-structure.md](auth-structure.md); do not restore old token cookies or
> custom OAuth/session modules from these historical notes.

Run `pnpm dev` in the project root; a single Next.js application listens on 3030.
Production uses `pnpm build` (default Turbopack) and `pnpm start`.

## Layout

- `app/(auth)`: auth pages, separate from API entry points.
- `app/(api)/[...route]/route.ts`: the HTTP entry, exporting `handle(routes)`.
- `routes/index.ts`: Hono domain composition; `middlewares/http.ts` owns
  HTTP policy and post-commit realtime/background scheduling.
- Root `routes`, `controllers`, `middlewares`, `services`, `schemas`, `database`:
  server domain code. Domain controllers use native Hono Context.
- `services/client`, `schemas/client`: browser API clients and response contracts.
- `utils/formatter.ts`: backend formatting; `utils/client/formatter.ts`: rendering
  and toast-related helpers. Server modules must not import UI dependencies.
- `utils/environment.ts`: the only application environment reader.
- `pkg`: unchanged archive; not imported, linted, typechecked or built.

Chat clients call `/user`, `/conversation`, `/message`, etc.
The UI retains `/chat/[id]`; API paths no longer need per-domain Next bridges.
WebSocket upgrades and Queue/Cron callbacks retain their platform-specific
Route Handlers and duration/trigger configuration.
There is no `/api` URL prefix, old `/proxy/chat` endpoint, listener on 5050,
client-to-server rewrite, signed BFF RPC or self-fetch to `/auth/me`.
Platform forwarding keeps the existing `/resource`, `/notification`, `/discovery`
URLs and contacts the owning platform service directly.

## Authentication

SSO still owns identity. This app owns the encrypted DB session and performs
OIDC/PKCE/state/nonce validation through the installed Structure helpers.
Login always requests `select_account`; account creation requests `create`.
The login transaction expires after 120 seconds. Session handles are HttpOnly;
access and refresh tokens are never included in public JSON.

Logout removes this app session before attempting grant revocation; it does not
redirect to SSO end-session or end the browser's central SSO session. Signed
backchannel logout and bearer/DPoP verification retain separate authentication.
Cookie mutations check the configured app origin. Protected Chat APIs verify
token signature, audience, scopes, revocation and local membership/role/status.
Shared services validate their own audience/scopes and link users by SSO `sub`.

Root `.env` / `.env.local` is loaded by Next. Use the names in `.env.example`.
Move the former server's **same session secret** to `NEXT_SESSION_SECRET` when
retaining sessions. Seven independent `NEXT_OAUTH_*_AUDIENCE` variables configure
Notify, Resource, Discovery, Payment, Billing, Media and Insight (empty values are
not requested). There is no `NEXT_OAUTH_RESOURCES` aggregate.
`NEXT_OAUTH_AUDIENCE=http://localhost:3030` now identifies local Chat. The SSO
resource and its client link were migrated from the retired 5050 registration,
preserving Chat's existing scopes and policy; other apps were not changed.
Production uses its separately registered HTTPS audience. No schema change or
cloud schema push is required for this consolidation.

App session bindings now include the Chat audience. Older handles must log in
again rather than reporting an authenticated UI whose API token has the wrong
audience; this does not log out the central SSO session. Background 30-second
session polling no longer sets full-page loading: the mounted Chat UI, draft
and realtime components remain present while a read is busy. A confirmed 401
clears the public identity even when React Query still has old data; a transient
read outage is surfaced without remounting the previously loaded UI. API
authorization remains authoritative throughout.

The proxy is only an optimistic navigation gate. It does not access DB, SSO or
this app's HTTP endpoints. Stale cookies cannot create a home/chat redirect loop;
the authoritative API/DAL and browser AuthGuard decide authenticated state.

Obsolete Express-style adapters, unused Supabase/token auth scaffolding and
the old server's static HTML endpoints remain only in `pkg`. Public assets now
come from `public` and the Next app favicon.

## Verification

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
Tests use isolated fixtures, not the live cloud DB or real SSO credentials.

Verified during this migration:

- TypeScript and ESLint passed.
- Vitest: 87 tests passed across 15 files, including native Hono authorization,
  duplicate-cookie handling, local logout, API route precedence, direct session
  reads, background refresh UI, legacy audience session rejection and the
  seven-resource configuration.
- Production Next.js 16.4.0 Turbopack build passed. In the restricted task
  environment it was invoked directly with
  `node node_modules/next/dist/bin/next build`, equivalent to the package's
  default `next build` script; no webpack fallback was added.
- Anonymous production HTTP smoke checks: `/` returned HTML 200; `/health`
  returned JSON 200; protected Auth, Chat, Resource and Lab APIs returned JSON
  401; unknown API paths returned JSON 404. The temporary process was stopped.
- The SSO DB migration was applied only to Chat's resource registration and
  verified read-only afterward: old audience absent, new audience present,
  original six scopes retained and exactly one Chat client link. No cloud schema
  changes, user deletion, central-session deletion or authenticated live SSO
  login was performed.
- Live `/auth/start` returned 302 with `prompt=select_account` and resource
  `http://localhost:3030`; protected-resource metadata reports the same audience.
- Anonymous SSO authorize accepted that resource and returned 302 to sign-in,
  without an OAuth error. This does not prove a real-user token exchange.
- Isolated Brave headless UI smoke test with intercepted public API fixtures:
  4 session reads, no loss of the mounted Chat node and no extra document load
  across a real 30-second polling interval (including a delayed background
  response). No real browser profile, user cookies or SSO credentials were used.

The security and OAuth boundaries were checked against the installed Better Auth
1.7.7 integration surface and the official
[Hono integration](https://better-auth.com/docs/integrations/hono),
[session management](https://better-auth.com/docs/concepts/session-management)
and [OAuth provider](https://better-auth.com/docs/plugins/oauth-provider)
documentation. The app remains an OAuth client of Gorth SSO; it does not create
a second independent Better Auth identity authority.
