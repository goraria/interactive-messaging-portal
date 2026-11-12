# Fullstack environment URLs

Use `.env.example` as the active root contract. Files under `pkg` are archived
and do not configure the fullstack application.

- `NEXT_PUBLIC_APP_URL`: Chat origin, locally `http://localhost:3030`.
- `NEXT_PUBLIC_AUTH_URL`: fullstack SSO origin, locally `http://localhost:3000`.
  All OAuth endpoints use this origin; no separate port 8080 backend is needed.
- `NEXT_PUBLIC_OAUTH_CLIENT_ID`: registered Chat OAuth client identifier.
- `NEXT_OAUTH_AUDIENCE`: Chat OAuth resource identifier.
- `NEXT_OAUTH_NOTIFY_AUDIENCE`, `NEXT_OAUTH_RESOURCE_AUDIENCE` and
  `NEXT_OAUTH_DISCOVERY_AUDIENCE`: registered resource identifiers and HTTP
  origins for server-side platform forwarding.
- `NEXT_OAUTH_PAYMENT_AUDIENCE`, `NEXT_OAUTH_BILLING_AUDIENCE`,
  `NEXT_OAUTH_MEDIA_AUDIENCE` and `NEXT_OAUTH_INSIGHT_AUDIENCE`: optional
  resources; blank values are omitted from OAuth requests.

Remove obsolete SSO client/server URL variables and duplicate platform
server URL variables from private env and deployment configuration.
There are no compatibility fallbacks.
Browser API calls remain same-origin relative paths, not port 5050.

Restart development after changing environment values. Set public variables
before production builds because Next.js includes them at build time.
Private env files and their secrets are not copied or edited by this migration.
