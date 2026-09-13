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
export const accessTokenCookie = process.env.GORTH_ACCESS_TOKEN!

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
