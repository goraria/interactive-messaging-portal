import * as environment from "../utils/environment.ts"
import { inspectDeploymentConfiguration } from "../utils/deployment.ts"

const result = inspectDeploymentConfiguration({
  NEXT_PUBLIC_APP_URL: environment.appUrl,
  NEXT_PUBLIC_AUTH_URL: environment.authUrl,
  NEXT_OAUTH_CLIENT_ID: environment.oauthClientId,
  NEXT_OAUTH_COOKIE_PREFIX: environment.oauthCookiePrefix,
  NEXT_OAUTH_AUDIENCE: environment.oauthAudience,
  NEXT_OAUTH_NOTIFY_AUDIENCE: environment.oauthNotifyAudience,
  NEXT_OAUTH_RESOURCE_AUDIENCE: environment.oauthResourceAudience,
  NEXT_OAUTH_DISCOVERY_AUDIENCE: environment.oauthDiscoveryAudience,
  NEXT_OAUTH_PAYMENT_AUDIENCE: environment.oauthPaymentAudience,
  NEXT_OAUTH_BILLING_AUDIENCE: environment.oauthBillingAudience,
  NEXT_OAUTH_MEDIA_AUDIENCE: environment.oauthMediaAudience,
  NEXT_OAUTH_INSIGHT_AUDIENCE: environment.oauthInsightAudience,
  NEXT_SESSION_SECRET: environment.sessionSecret,
  DATABASE_URL: environment.databaseUrl,
  NEXT_OAUTH_CLIENT_SECRET: environment.oauthClientSecret,
  AWS_ENDPOINT_URL_S3: environment.awsEndpointUrlS3,
  AWS_ACCESS_KEY_ID: environment.awsAccessKeyId,
  AWS_SECRET_ACCESS_KEY: environment.awsSecretAccessKey,
  AWS_REGION: environment.awsRegion,
  AWS_BUCKET: environment.awsBucket,
  CRON_SECRET: environment.cronSecret,
  NEXT_CHAT_ICE_SERVERS_JSON: environment.chatIceServersJson,
})
for (const warning of result.warnings) console.warn("[deployment] " + warning)
for (const error of result.errors) console.error("[deployment] " + error)
if (result.errors.length) process.exitCode = 1
else console.log("Deployment configuration syntax passed; cloud access and SSO registration still require acceptance tests.")
