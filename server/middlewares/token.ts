import type { Request, Response } from "express";

const isProd = process.env.NODE_ENV === "production";

// Tên cookie phong cách Clerk
export const ACCESS_COOKIE = "access_token" // "__session";   // access token
export const REFRESH_COOKIE = "refresh_token" // "__refresh";  // refresh token

export type Session = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;   // seconds (preferred)
  expires_at?: number;   // epoch seconds (optional)
};

type SetCookieOpts = {
  maxAge?: number;
  domain?: string;
  path?: string;
  sameSite?: "lax" | "strict" | "none";
  secure?: boolean;
  httpOnly?: boolean;
};

function setCookie(
  res: Response,
  name: string,
  value: string,
  opts: SetCookieOpts = {}
) {
  const {
    maxAge,
    domain,
    path = "/",
    sameSite = isProd ? "none" : "lax",
    secure = isProd, // cần HTTPS khi sameSite=none
    httpOnly = true,
  } = opts;

  res.cookie(name, value, {
    maxAge,
    domain,
    path,
    sameSite,
    secure,
    httpOnly,
  });
}

function msForAccess(
  session: Session
): number {
  if (session.expires_in && Number.isFinite(session.expires_in)) {
    // subtract small safety window (120s)
    return Math.max(0, (session.expires_in - 120) * 1000);
  }
  if (session.expires_at) {
    const ms = session.expires_at * 1000 - Date.now() - 120_000;
    return Math.max(0, ms);
  }
  // fallback 55m
  return 55 * 60 * 1000;
}

type SupabaseSessionCookie = {
  access_token?: string;
  refresh_token?: string;
};

function decodeSupabaseCookiePayload(rawValue: string): SupabaseSessionCookie | null {
  if (!rawValue) return null;

  const trimmed = rawValue.startsWith("base64-") ? rawValue.slice(7) : rawValue;
  const normalized = trimmed.replace(/-/g, "+").replace(/_/g, "/");
  const paddingNeeded = normalized.length % 4;
  const padded = paddingNeeded ? normalized + "=".repeat(4 - paddingNeeded) : normalized;

  try {
    const json = Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object") {
      return {
        access_token: parsed.access_token,
        refresh_token: parsed.refresh_token,
      };
    }
  } catch (error) {
    return null;
  }

  return null;
}

function readSupabaseAuthCookie(req: Request): SupabaseSessionCookie | null {
  const cookies = (req as any).cookies as Record<string, string> | undefined;
  if (!cookies) return null;

  const chunkRegex = /^(sb-[a-z0-9]+-auth-token)(?:\.(\d+))?$/i;
  const chunksByCookie = new Map<string, Map<number, string>>();

  for (const [name, value] of Object.entries(cookies)) {
    const match = name.match(chunkRegex);
    if (!match) continue;
    const baseName = match[1] || "";
    const index = match[2] ? Number(match[2]) : 0;
    if (!Number.isFinite(index)) continue;
    if (!chunksByCookie.has(baseName)) {
      chunksByCookie.set(baseName, new Map());
    }
    chunksByCookie.get(baseName)?.set(index, value);
  }

  for (const chunkMap of chunksByCookie.values()) {
    const combined = Array.from(chunkMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([, value]) => value)
      .join("");

    const parsed = decodeSupabaseCookiePayload(combined);
    if (parsed?.access_token) {
      return parsed;
    }
  }

  return null;
}

export function setAuthCookiesFromSession(
  res: Response,
  session: Session,
  cookieDomain?: string
) {
  const access = session?.access_token;
  const refresh = session?.refresh_token;

  if (access) setCookie(res, ACCESS_COOKIE, access, { maxAge: msForAccess(session), domain: cookieDomain });
  if (refresh) setCookie(res, REFRESH_COOKIE, refresh, { maxAge: 30 * 24 * 60 * 60 * 1000, domain: cookieDomain });
}

export function setAuthCookiesFromTokens(
  res: Response,
  accessToken: string,
  refreshToken: string,
  cookieDomain?: string
) {
  // Access token: 7 days
  setCookie(res, ACCESS_COOKIE, accessToken, {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    domain: cookieDomain
  });

  // Refresh token: 30 days
  setCookie(res, REFRESH_COOKIE, refreshToken, {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    domain: cookieDomain
  });
}

// export function setAuthCookies(res: Response, session: any, cookieDomain?: string) {
//   const access = session?.access_token;
//   const refresh = session?.refresh_token;
//
//   // Access token thường ngắn hạn (ví dụ 1h)
//   if (access) {
//     // 58 phút
//     setCookie(res, ACCESS_COOKIE, access, { maxAge: 58 * 60 * 1000, domain: cookieDomain });
//   }
//
//   if (refresh) {
//     // 30 ngày
//     setCookie(res, REFRESH_COOKIE, refresh, { maxAge: 30 * 24 * 60 * 60 * 1000, domain: cookieDomain });
//   }
// }

export function clearAuthCookies(
  res: Response,
  cookieDomain?: string,
  req?: Request
) {
  // Clear Express auth cookies
  res.clearCookie(ACCESS_COOKIE, {
    path: "/",
    domain: cookieDomain
  });
  res.clearCookie(REFRESH_COOKIE, {
    path: "/",
    domain: cookieDomain
  });
  
  // Clear ALL Supabase cookies dynamically
  // Supabase uses pattern: sb-{project-ref}-auth-token.{index}
  if (req && (req as any).cookies) {
    const cookies = (req as any).cookies;
    Object.keys(cookies).forEach(cookieName => {
      // Clear any cookie starting with 'sb-' (Supabase cookies)
      if (cookieName.startsWith('sb-')) {
        res.clearCookie(cookieName, {
          path: "/",
          domain: cookieDomain
        });
        console.log(`🧹 Cleared Supabase cookie: ${cookieName}`);
      }
    });
  }
}

export function readAuthCookies(req: Request) {
  const cookies = (req as any).cookies as Record<string, string> | undefined;
  const accessToken = cookies?.[ACCESS_COOKIE];
  const refreshToken = cookies?.[REFRESH_COOKIE];

  if (accessToken || refreshToken) {
    return { accessToken, refreshToken };
  }

  const supabaseSession = readSupabaseAuthCookie(req);
  return {
    accessToken: supabaseSession?.access_token,
    refreshToken: supabaseSession?.refresh_token,
  };
}
