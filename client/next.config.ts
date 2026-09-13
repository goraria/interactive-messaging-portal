import type { NextConfig } from "next"

import { apiBaseUrl } from "./lib/utils/environment"

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: ["@gorth/primitive"],

  devIndicators: false,
  images: {
    remotePatterns: [],
  },

  async rewrites() {
    return [
      {
        source: "/proxy/chat/:path*",
        destination: `${apiBaseUrl}/chat/:path*`,
      },
    ]
  },
}

export default nextConfig
