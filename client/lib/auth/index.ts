import { createAuthClient } from "@/lib/structure/auth/client"

export const auth = createAuthClient({
  // Client configuration options can be added here
  // baseURL is automatically inferred from the current origin
  basePath: "/auth",
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080",
  // baseURL: process.env.NEXT_PUBLIC_API_BASE_URL as string,
  fetchOptions: {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    }
  },
  plugins: [
    // sentinelClient(),
  ],
});
