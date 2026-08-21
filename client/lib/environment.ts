// --- AUTH & API CONFIG ---
export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
export const apiAuthUrl = process.env.NEXT_PUBLIC_AUTH_URL;
export const redirectUrl = process.env.NEXT_PUBLIC_ALLOWED_REDIRECT_ORIGINS;
export const ssoOAuthClientId =
  process.env.NEXT_PUBLIC_SSO_OAUTH_CLIENT_ID ??
  "gorth-interactive-messaging-portal";

export const routes = {
  login: process.env.NEXT_PUBLIC_SIGN_IN_DIRECT_URL ?? "http://localhost:3000/auth/sign-in",
  register: process.env.NEXT_PUBLIC_SIGN_UP_DIRECT_URL ?? "http://localhost:3000/auth/sign-up",
  setting: process.env.NEXT_PUBLIC_SETTING_DIRECT_URL ?? "/setting",
} as const;

// --- BETTER AUTH CONFIG ---
export const betterAuthUrl = process.env.BETTER_AUTH_URL;
