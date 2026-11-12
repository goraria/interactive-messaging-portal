import dotenv from "dotenv"

dotenv.config({
  path: ".env.local",
  // Runtime variables from Vercel, Docker, or CI must win over local values.
  override: false,
  debug: false,
  quiet: true,
})

// --- AUTH & API CONFIG ---
export const nodeEnv = process.env.NODE_ENV!
export const isProduction = nodeEnv === "production"
export const port = process.env.VITE_PUBLIC_PORT!
export const serverUrl = process.env.VITE_PUBLIC_SERVER_URL!
export const clientUrl = process.env.VITE_PUBLIC_CLIENT_URL!
export const mobileUrl = process.env.VITE_PUBLIC_MOBILE_URL!
export const authUrl = process.env.VITE_PUBLIC_AUTH_URL!
export const ssoServerUrl = process.env.VITE_PUBLIC_SSO_SERVER_URL!
export const ssoClientUrl = process.env.VITE_PUBLIC_SSO_CLIENT_URL!
export const ssoOAuthClientId = process.env.VITE_PUBLIC_SSO_OAUTH_CLIENT_ID!
export const authSecret = process.env.VITE_AUTH_SECRET!
export const sessionSecret = process.env.VITE_SESSION_SECRET!
export const oauthResources = process.env.VITE_OAUTH_RESOURCES ?? ""
export const sessionMaxAgeSeconds =
  process.env.VITE_SESSION_MAX_AGE_SECONDS ?? "2592000"
export const accessTokenCookie = process.env.GORTH_ACCESS_TOKEN!
export const refreshTokenCookie = process.env.GORTH_REFRESH_TOKEN!
export const sessionAppCookie =
  process.env.GORTH_SESSION_APP ?? "gorth.session_app"
export const oauthStateCookie =
  process.env.GORTH_OAUTH_STATE ?? "gorth.oauth_state"
export const oauthCodeVerifierCookie =
  process.env.GORTH_OAUTH_CODE_VERIFIER ?? "gorth.oauth_code_verifier"
export const oauthReturnToCookie =
  process.env.GORTH_OAUTH_RETURN_TO ?? "gorth.oauth_return_to"
export const oauthIssuerCookie =
  process.env.GORTH_OAUTH_ISSUER ?? "gorth.oauth_issuer"
export const oauthNonceCookie =
  process.env.GORTH_OAUTH_NONCE ?? "gorth.oauth_nonce"

export const databaseUrl = process.env.DATABASE_URL!
export const pgPoolMax = process.env.PG_POOL_MAX!
export const ablyApiKey = process.env.ABLY_API_KEY!

export const csrfEnabled = process.env.CSRF_ENABLED === "true"
export const csrfSecret = process.env.CSRF_SECRET!
export const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED === "true"

export function getCorsOrigins(): string[] {
  return [clientUrl, mobileUrl].filter((origin): origin is string =>
    Boolean(origin)
  )
}
export const oauthReadScope = "chat:read"
export const oauthWriteScope = "chat:write"
