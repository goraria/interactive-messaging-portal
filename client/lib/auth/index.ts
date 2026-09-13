import { createAuthClient } from "@gorth/structure/cores/auth/client/index"
import { apiBaseUrl } from "@/lib/utils/environment"

export const auth = createAuthClient({
  // Client configuration options can be added here
  // baseURL is automatically inferred from the current origin
  basePath: "/auth",
  baseURL: apiBaseUrl || "http://localhost:8080",
  fetchOptions: {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  },
  plugins: [
    // sentinelClient(),
  ],
})
