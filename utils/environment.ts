// Next loads .env files. Keep all application environment reads here.
export const nodeEnv = process.env.NODE_ENV
// Framework-owned runtime markers; Next sets these, not application operators.
export const nextRuntime = process.env.NEXT_RUNTIME
export const nextPhase = process.env.NEXT_PHASE
export const vercelDeployment = process.env.VERCEL === "1"
export const cronSecret = process.env.CRON_SECRET ?? ""
export const isProduction = nodeEnv === "production"
export const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
export const authUrl = process.env.NEXT_PUBLIC_AUTH_URL ?? ""
export const oauthClientId = process.env.NEXT_PUBLIC_OAUTH_CLIENT_ID ?? ""
export const sessionSecret = process.env.NEXT_SESSION_SECRET ?? ""
// Logical resource identifier, not an HTTP upstream. Preserve the registered
// audience when consolidating the app; changing it also requires SSO consent.
export const oauthAudience = process.env.NEXT_OAUTH_AUDIENCE ?? ""
export const oauthNotifyAudience = process.env.NEXT_OAUTH_NOTIFY_AUDIENCE ?? ""
export const oauthResourceAudience =
  process.env.NEXT_OAUTH_RESOURCE_AUDIENCE ?? ""
export const oauthDiscoveryAudience =
  process.env.NEXT_OAUTH_DISCOVERY_AUDIENCE ?? ""
export const oauthPaymentAudience =
  process.env.NEXT_OAUTH_PAYMENT_AUDIENCE ?? ""
export const oauthBillingAudience =
  process.env.NEXT_OAUTH_BILLING_AUDIENCE ?? ""
export const oauthMediaAudience = process.env.NEXT_OAUTH_MEDIA_AUDIENCE ?? ""
export const oauthInsightAudience =
  process.env.NEXT_OAUTH_INSIGHT_AUDIENCE ?? ""
export const sessionMaxAgeSeconds =
  process.env.NEXT_SESSION_MAX_AGE_SECONDS ?? "2592000"
export const databaseUrl = process.env.DATABASE_URL ?? ""
export const pgPoolMax = process.env.PG_POOL_MAX ?? "5"
// Matching the Next origin port uses a private listener behind its WS rewrite.
export const websocketPort = Number(process.env.NEXT_WEBSOCKET_PORT ?? "3030")
// The existing confidential backend identity; never the public sign-in client.
export const serverOauthClientId = process.env.NEXT_OAUTH_CLIENT_ID ?? ""
export const serverOauthClientSecret =
  process.env.NEXT_OAUTH_CLIENT_SECRET ?? ""
export const oauthTokenEndpointAuthMethod =
  process.env.NEXT_OAUTH_TOKEN_ENDPOINT_AUTH_METHOD ?? "client_secret_basic"
export const chatIceServersJson = process.env.NEXT_CHAT_ICE_SERVERS_JSON ?? "[]"
export const awsEndpointUrlS3 = process.env.AWS_ENDPOINT_URL_S3 ?? ""
export const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID ?? ""
export const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY ?? ""
export const awsRegion = process.env.AWS_REGION ?? "ap-southeast-1"
export const awsBucket = process.env.AWS_BUCKET ?? ""
export const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED === "true"
export const oauthReadScope = "chat:read"
export const oauthWriteScope = "chat:write"
export const routes = {
  login: authUrl ? new URL("/auth/sign-in", authUrl).toString() : "",
  register: authUrl ? new URL("/auth/sign-up", authUrl).toString() : "",
  setting: authUrl ? new URL("/setting", authUrl).toString() : "",
} as const
export const oauthCookiePrefix = process.env.NEXT_OAUTH_COOKIE_PREFIX ?? ""
// Telemetry is Vercel-only; do not opt into a separately configured collector.
export const vercelTelemetryEnabled = process.env.VERCEL === "1" &&
  ![process.env.OTEL_EXPORTER_OTLP_ENDPOINT, process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
  process.env.OTEL_EXPORTER_OTLP_HEADERS, process.env.OTEL_EXPORTER_OTLP_TRACES_HEADERS].some(Boolean)
