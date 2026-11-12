// Report variable names only. Never include configured secrets or URL values.
export function inspectDeploymentConfiguration(values: Record<string, string>) {
  const errors: string[] = []
  const warnings: string[] = []
  const origin = (name: string, https = true) => {
    try {
      const url = new URL(values[name] ?? "")
      if (url.pathname !== "/" || url.username || url.password || url.search || url.hash ||
          (https ? url.protocol !== "https:" : !["https:", "http:"].includes(url.protocol)) ||
          (https && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) throw new Error()
    } catch { errors.push(name + ": invalid production origin") }
  }
  origin("NEXT_PUBLIC_APP_URL")
  origin("NEXT_PUBLIC_AUTH_URL")
  // An audience is a registered identifier; it need not be a reachable upstream.
  origin("NEXT_OAUTH_AUDIENCE", false)
  for (const service of ["NOTIFY", "RESOURCE", "DISCOVERY", "PAYMENT", "BILLING", "MEDIA", "INSIGHT"])
    origin(`NEXT_OAUTH_${service}_AUDIENCE`)
  if (!values.NEXT_PUBLIC_OAUTH_CLIENT_ID || values.NEXT_PUBLIC_OAUTH_CLIENT_ID.endsWith("-local"))
    errors.push("NEXT_PUBLIC_OAUTH_CLIENT_ID: production client required")
  if (!/^[A-Za-z0-9_.-]+$/.test(values.NEXT_OAUTH_COOKIE_PREFIX ?? ""))
    errors.push("NEXT_OAUTH_COOKIE_PREFIX: invalid cookie prefix")
  for (const name of ["NEXT_SESSION_SECRET", "CRON_SECRET"])
    if (new TextEncoder().encode(values[name] ?? "").length < 32)
      errors.push(name + ": at least 32 bytes required")
  for (const name of ["NEXT_OAUTH_CLIENT_ID", "NEXT_OAUTH_CLIENT_SECRET", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION", "AWS_BUCKET"])
    if (!values[name]?.trim()) errors.push(name + ": required")
  if (!["client_secret_basic", "client_secret_post"].includes(values.NEXT_OAUTH_TOKEN_ENDPOINT_AUTH_METHOD ?? ""))
    errors.push("NEXT_OAUTH_TOKEN_ENDPOINT_AUTH_METHOD: unsupported method")
  origin("AWS_ENDPOINT_URL_S3")
  try {
    const url = new URL(values.DATABASE_URL ?? "")
    if (!["postgres:", "postgresql:"].includes(url.protocol) ||
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error()
  } catch { errors.push("DATABASE_URL: hosted PostgreSQL required") }
  try {
    const ice: unknown = JSON.parse(values.NEXT_CHAT_ICE_SERVERS_JSON || "[]")
    if (!Array.isArray(ice) || ice.length > 10) throw new Error()
    let turn = false
    for (const server of ice) {
      const urls = Array.isArray(server?.urls) ? server.urls : [server?.urls]
      if (!urls.length || urls.some((url: unknown) => typeof url !== "string" || !/^(turns?|stuns?):/.test(url))) throw new Error()
      if (urls.some((url: string) => /^turns?:/.test(url)) && server.username && server.credential) turn = true
    }
    if (!turn) warnings.push("NEXT_CHAT_ICE_SERVERS_JSON: remote calls need a tested TURN provider")
  } catch { errors.push("NEXT_CHAT_ICE_SERVERS_JSON: invalid ICE configuration") }
  return { errors, warnings }
}
