import dotenv from "dotenv"

dotenv.config({
  path: ".env.local",
  // Runtime variables from Vercel, Docker, or CI must win over local values.
  override: false,
  debug: false,
  quiet: true,
})

export const expressNodeEnv = process.env.EXPRESS_NODE_ENV
export const expressEnv = process.env.EXPRESS_ENV ?? expressNodeEnv
export const isExpressProduction = expressEnv === "production" || expressNodeEnv === "production"
export const expressPort = process.env.EXPRESS_PORT
export const expressJwtSecret = process.env.EXPRESS_JWT_SECRET
export const expressSessionSecret = process.env.EXPRESS_SESSION_SECRET
export const expressApiBaseUrl = process.env.EXPRESS_API_BASE_URL
export const expressAuthUrl = process.env.EXPRESS_AUTH_URL
export const allowedRedirectOrigins = process.env.EXPRESS_ALLOWED_REDIRECT_ORIGINS
export const betterAuthUrl = process.env.BETTER_AUTH_API_KEY
export const betterAuthSecret = process.env.BETTER_AUTH_URL
export const ssoServerUrl = process.env.EXPRESS_SSO_SERVER_URL
export const ssoInternalSecret = process.env.EXPRESS_SSO_INTERNAL_SECRET
export const ssoClientInternalSecret = process.env.EXPRESS_SSO_CLIENT_INTERNAL_SECRET
export const accessTokenSecret = process.env.EXPRESS_GORTH_ACCESS_TOKEN_SECRET
export const refreshTokenSecret = process.env.EXPRESS_GORTH_REFRESH_TOKEN_SECRET
export const accessTokenExpiresIn = process.env.EXPRESS_GORTH_ACCESS_TOKEN_EXPIRES_IN
export const refreshTokenExpiresIn = process.env.EXPRESS_GORTH_REFRESH_TOKEN_EXPIRES_IN
export const notificationCenterUrl = process.env.EXPRESS_NOTIFICATION_CENTER_URL
export const paymentGatewayUrl = process.env.EXPRESS_PAYMENT_GATEWAY_URL
export const searchEngineUrl = process.env.EXPRESS_SEARCH_ENGINE_URL
export const billingSubscriptionUrl = process.env.EXPRESS_BILLING_SUBSCRIPTION_URL
export const databaseUrl = process.env.DATABASE_URL
export const pgPoolMax = process.env.EXPRESS_PG_POOL_MAX
export const supabaseUrl = process.env.EXPRESS_SUPABASE_URL
export const supabaseAnonKey = process.env.EXPRESS_SUPABASE_ANON_KEY
export const supabaseServiceRoleKey = process.env.EXPRESS_SUPABASE_SERVICE_ROLE_KEY
export const supabaseDirectUrl = process.env.EXPRESS_SUPABASE_DIRECT_URL
export const googleClientId = process.env.GOOGLE_CLIENT_ID
export const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET
export const expressClientUrl = process.env.EXPRESS_CLIENT_URL
export const expressMobileUrl = process.env.EXPRESS_MOBILE_URL
export const expressLocalUrl = process.env.EXPRESS_LOCAL_URL
export const expressServerUrl = process.env.EXPRESS_SERVER_URL
