import { genericOAuth } from "better-auth/plugins/generic-oauth";
import {
  createOAuthIdentityValidator,
  createOAuthProviderConfig,
} from "@gorth-com/structure/modules/auth/server";

export const validateGorthUser = createOAuthIdentityValidator({
  providerId: "gorth",
  subject: (user) => user.externalUserId,
  allowed: (profile) => !profile.status || profile.status === "active",
});

// The protocol implementation (PKCE, state, nonce, discovery and ID-token
// verification) belongs to Better Auth, not the application.
export function gorthProvider(
  origin: string,
  clientId: string,
  resources: string[],
  credentials: { clientSecret: string },
) {
  // Native Generic OAuth accepts string-valued extra parameters. Preserve
  // repeated RFC 8707 resources on the backend-owned authorization endpoint.
  const authorization = new URL("/auth/oauth2/authorize", origin);
  for (const resource of resources)
    authorization.searchParams.append("resource", resource);
  return genericOAuth({
    config: [
      createOAuthProviderConfig({
        // getAuthConfig already validates these registered app/resource origins.
        allowLoopbackHttp: [origin, ...resources].some((value) => {
          const endpoint = new URL(value);
          return (
            endpoint.protocol === "http:" &&
            ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname)
          );
        }),
        providerId: "gorth",
        name: "Gorth SSO",
        authorizationUrl: authorization.href,
        clientId,
        discoveryUrl: new URL("/auth/.well-known/openid-configuration", origin)
          .href,
        clientSecret: credentials.clientSecret,
        tokenEndpointAuth: { method: "client_secret_basic" },
        scopes: [
          "openid",
          "profile",
          "email",
          "offline_access",
          "chat:read",
          "chat:write",
        ],
        prompt: "select_account",
        disableProviderLogout: true,
        mapProfileToUser(profile) {
          return {
            externalUserId: String(profile.sub),
            emailVerified: profile.email_verified === true,
            username:
              typeof profile.preferred_username === "string"
                ? profile.preferred_username
                : null,
            image:
              typeof profile.picture === "string" ? profile.picture : undefined,
            ssoStatus:
              typeof profile.status === "string" ? profile.status : "active",
          };
        },
      }),
    ],
  });
}
