import type { NextFunction, Request, Response } from "express"
import { isExpressProduction, ssoServerUrl } from "@/lib/utils/environment"

const gorthAppClaim = "https://gorth.dev/claims/app"

export interface AuthUser {
  id: string
  email: string
  name: string | null
  image: string | null
}

export interface AuthContext {
  authenticated: true
  verifiedBy: "single-sign-on"
  user: AuthUser
  app: Record<string, unknown> | null
}

interface SsoVerifyPayload {
  sub?: string
  email?: string
  name?: string | null
  picture?: string | null
  user_metadata?: Record<string, unknown>
  gorth_app?: Record<string, unknown>
  [gorthAppClaim]?: Record<string, unknown>
}

interface OAuthErrorPayload {
  error?: string
  error_description?: string
}

async function readOAuthError(response: globalThis.Response) {
  try {
    return (await response.json()) as OAuthErrorPayload
  } catch {
    return null
  }
}

function getAccessToken(request: Request) {
  const authorization = request.get("authorization")

  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim()
  }

  return request.cookies?.["gorth.access_token"] ?? ""
}

function getUserName(payload: SsoVerifyPayload) {
  const metadataName = payload.user_metadata?.name
  if (typeof metadataName === "string") return metadataName
  return payload.name ?? null
}

export function requireAuth() {
  return async (request: Request, response: Response, next: NextFunction) => {
    const accessToken = getAccessToken(request)

    if (!accessToken) {
      return response.status(401).json({ error: "missing_access_token" })
    }

    const baseUrl =
      ssoServerUrl ??
      (!isExpressProduction ? "http://localhost:8080" : undefined)
    if (!baseUrl) {
      return response.status(500).json({ error: "missing_sso_server_url" })
    }

    try {
      const endpoint = new URL("/auth/oauth2/userinfo", baseUrl)
      const verifyResponse = await fetch(endpoint, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      })

      if (!verifyResponse.ok) {
        const detail = await readOAuthError(verifyResponse)

        console.warn("[auth] SSO userinfo rejected access token", {
          endpoint: endpoint.pathname,
          status: verifyResponse.status,
          error: detail?.error,
          description: detail?.error_description,
        })

        // Refresh-token rotation is owned by the Next.js /auth/me route, which
        // can update the browser's HttpOnly cookies. The API only verifies the
        // presented access token and returns 401 so the client can refresh once.
        return response.status(401).json({
          error: "invalid_access_token",
          oauth_error: detail?.error,
        })
      }

      const payload = (await verifyResponse.json()) as SsoVerifyPayload
      if (!payload.sub || !payload.email) {
        return response.status(401).json({ error: "invalid_access_token" })
      }

      response.locals.auth = {
        authenticated: true,
        verifiedBy: "single-sign-on",
        user: {
          id: payload.sub,
          email: payload.email,
          name: getUserName(payload),
          image: payload.picture ?? null,
        },
        app: payload[gorthAppClaim] ?? payload.gorth_app ?? null,
      } satisfies AuthContext

      return next()
    } catch (error) {
      console.error("[auth] SSO userinfo request failed", {
        endpoint: "/auth/oauth2/userinfo",
        message: error instanceof Error ? error.message : "unknown_error",
      })
      return response.status(502).json({ error: "sso_unavailable" })
    }
  }
}

// import { Request, Response, NextFunction } from "express";
// import { auth } from "./auth"; // File cấu hình Better Auth của bạn
// import { fromNodeHeaders } from "better-auth/node"; // Helper chuyển đổi header

// export async function requireAuth(req: Request, res: Response, next: NextFunction) {
//     try {
//         // 1. Chuyển đổi headers của Node/Express sang định dạng Better Auth yêu cầu
//         const baHeaders = fromNodeHeaders(req.headers);

//         // 2. Gọi API kiểm tra session (tự động đọc cookie hoặc bearer token tùy cấu hình)
//         const session = await auth.api.getSession({
//             headers: baHeaders
//         });

//         // 3. Nếu không có session hợp lệ -> Trả về lỗi 401 Unauthorized
//         if (!session) {
//             return res.status(401).json({ error: "Unauthorized" });
//         }

//         // 4. Lưu thông tin user và session vào req để sử dụng ở các route sau
//         req.user = session.user;
//         req.session = session.session;

//         next();
//     } catch (error) {
//         return res.status(500).json({ error: "Internal Server Error" });
//     }
// }
