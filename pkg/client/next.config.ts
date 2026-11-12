import type { NextConfig } from "next"
import { serverUrl } from "@/utils/environment"

const nextConfig: NextConfig = {
  async rewrites() {
    const target = new URL(serverUrl)
    if (
      target.username ||
      target.password ||
      target.pathname !== "/" ||
      target.search ||
      target.hash
    )
      throw new Error("invalid_app_server_url")
    // Fixed upstream only. Cookie/Origin/Set-Cookie are transported by Next;
    // OAuth and session ownership stay entirely in Hono.
    return {
      beforeFiles: [
        ...["start", "exchange", "me", "backchannel-logout", "session"].map(
          (route) => ({
            source: `/auth/${route}`,
            destination: `${target.origin}/auth/${route}`,
          })
        ),
        {
          source: "/proxy/chat/:path*",
          destination: `${target.origin}/chat/:path*`,
        },
        ...[
          "user",
          "conversation",
          "room",
          "message",
          "reaction",
          "receipt",
          "attachment",
        ].map((route) => ({
          source: `/chat/${route}/:path*`,
          destination: `${target.origin}/chat/${route}/:path*`,
        })),
      ],
      afterFiles: [],
      fallback: [],
    }
  },
  transpilePackages: ["@gorth/primitive"],

  devIndicators: false,
  images: {
    remotePatterns: [],
  },
}

export default nextConfig
