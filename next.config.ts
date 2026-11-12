import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: [""],

  devIndicators: false,
  images: {
    remotePatterns: [],
  },
  allowedDevOrigins: [""],
}

export default nextConfig
