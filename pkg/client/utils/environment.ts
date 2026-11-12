// --- AUTH & API CONFIG ---
export const nodeEnv = process.env.NODE_ENV!
export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL!
export const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL!
export const resourceInteractionServerUrl =
  process.env.NEXT_RESOURCE_INTERACTION_SERVER_URL!
export const discoveryEngineServerUrl = process.env.NEXT_DISCOVERY_SERVER_URL
export const notificationCenterServerUrl =
  process.env.NEXT_NOTIFICATION_CENTER_SERVER_URL!
export const clientUrl = process.env.NEXT_PUBLIC_CLIENT_URL!
export const authUrl = process.env.NEXT_PUBLIC_AUTH_URL!
export const ssoServerUrl = process.env.NEXT_PUBLIC_SSO_SERVER_URL!
export const ssoClientUrl = process.env.NEXT_PUBLIC_SSO_CLIENT_URL!
export const ssoOAuthClientId = process.env.NEXT_PUBLIC_SSO_OAUTH_CLIENT_ID!
export const accessTokenCookie = process.env.GORTH_ACCESS_TOKEN!
export const refreshTokenCookie = process.env.GORTH_REFRESH_TOKEN!
export const sessionAppCookie = process.env.GORTH_SESSION_APP!
export const oauthStateCookie = process.env.GORTH_OAUTH_STATE!
export const oauthCodeVerifierCookie = process.env.GORTH_OAUTH_CODE_VERIFIER!
export const oauthReturnToCookie = process.env.GORTH_OAUTH_RETURN_TO!
export const oauthIssuerCookie = process.env.GORTH_OAUTH_ISSUER!
export const oauthNonceCookie =
  process.env.GORTH_OAUTH_NONCE ?? "gorth.oauth_nonce"

export const routes = {
  login: new URL("/auth/sign-in", ssoClientUrl).toString(),
  register: new URL("/auth/sign-up", ssoClientUrl).toString(),
  setting: new URL("/setting", ssoClientUrl).toString(),
} as const
