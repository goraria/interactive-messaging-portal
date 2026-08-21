/**
 * =================================================================
 * CSRF PROTECTION MIDDLEWARE
 * Protect against Cross-Site Request Forgery attacks
 * =================================================================
 */

import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

/**
 * In-memory CSRF token store (use Redis in production)
 */
const tokenStore = new Map<string, { token: string; expiresAt: number }>();

/**
 * Generate CSRF token
 */
function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Hash token for storage
 */
function hashToken(token: string): string {
  const secret = process.env.EXPRESS_CSRF_SECRET || "default-csrf-secret";
  return crypto
    .createHmac("sha256", secret)
    .update(token)
    .digest("hex");
}

/**
 * Get or create CSRF token for session
 */
export function getCsrfToken(req: Request): string {
  const sessionId = req.sessionID || req.cookies?.["session-id"] || req.ip;
  
  // Check if token exists and is valid
  const stored = tokenStore.get(sessionId);
  if (stored && stored.expiresAt > Date.now()) {
    return stored.token;
  }

  // Generate new token
  const token = generateCsrfToken();
  const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

  tokenStore.set(sessionId, { token, expiresAt });

  // Cleanup expired tokens periodically
  if (Math.random() < 0.01) {
    cleanupExpiredTokens();
  }

  return token;
}

/**
 * Verify CSRF token
 */
function verifyCsrfToken(req: Request, token: string): boolean {
  const sessionId = req.sessionID || req.cookies?.["session-id"] || req.ip;
  
  const stored = tokenStore.get(sessionId);
  if (!stored || stored.expiresAt < Date.now()) {
    return false;
  }

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hashToken(token)),
      Buffer.from(hashToken(stored.token))
    );
  } catch {
    return false;
  }
}

/**
 * Cleanup expired tokens
 */
function cleanupExpiredTokens() {
  const now = Date.now();
  for (const [key, value] of tokenStore.entries()) {
    if (value.expiresAt < now) {
      tokenStore.delete(key);
    }
  }
}

/**
 * CSRF Protection Middleware
 * Apply to all state-changing routes (POST, PUT, DELETE, PATCH)
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF for safe methods
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Skip if CSRF is disabled
  const csrfEnabled = process.env.EXPRESS_CSRF_ENABLED === "true";
  if (!csrfEnabled) {
    return next();
  }

  // Skip for API endpoints with Bearer token authentication
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return next();
  }

  // Skip for webhooks
  if (req.path.includes("/webhook")) {
    return next();
  }

  // Get CSRF token from request
  const token =
    req.headers["x-csrf-token"] ||
    req.headers["csrf-token"] ||
    req.body?._csrf ||
    req.query?._csrf;

  if (!token || typeof token !== "string") {
    return res.status(403).json({
      ok: false,
      error: "CSRF token missing",
      message: "CSRF token is required for this request",
    });
  }

  // Verify token
  if (!verifyCsrfToken(req, token)) {
    return res.status(403).json({
      ok: false,
      error: "Invalid CSRF token",
      message: "CSRF token is invalid or expired",
    });
  }

  next();
}

/**
 * Middleware to attach CSRF token to response
 */
export function attachCsrfToken(req: Request, res: Response, next: NextFunction) {
  const token = getCsrfToken(req);
  
  // Attach to response locals for templates
  res.locals.csrfToken = token;
  
  // Set cookie
  const csrfEnabled = process.env.EXPRESS_CSRF_ENABLED === "true";
  const isProduction = process.env.EXPRESS_NODE_ENV === "production";
  
  res.cookie("csrf-token", token, {
    httpOnly: false, // Allow JavaScript to read for AJAX requests
    secure: csrfEnabled && isProduction,
    sameSite: "strict",
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });

  next();
}

/**
 * Express endpoint to get CSRF token
 * GET /api/csrf-token
 */
export function csrfTokenEndpoint(req: Request, res: Response) {
  const token = getCsrfToken(req);
  
  res.json({
    ok: true,
    csrfToken: token,
  });
}

/**
 * Double Submit Cookie Pattern
 * Alternative CSRF protection using cookies
 */
export function csrfDoubleSubmit(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const csrfEnabled = process.env.EXPRESS_CSRF_ENABLED === "true";
  if (!csrfEnabled) {
    return next();
  }

  const cookieToken = req.cookies?.["csrf-token"];
  const headerToken = req.headers["x-csrf-token"] || req.body?._csrf;

  if (!cookieToken || !headerToken) {
    return res.status(403).json({
      ok: false,
      error: "CSRF token missing",
    });
  }

  // Verify tokens match
  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(cookieToken),
      Buffer.from(headerToken as string)
    );

    if (!isValid) {
      return res.status(403).json({
        ok: false,
        error: "Invalid CSRF token",
      });
    }
  } catch {
    return res.status(403).json({
      ok: false,
      error: "Invalid CSRF token",
    });
  }

  next();
}

/**
 * CSRF Protection for specific routes
 */
export function requireCsrf(req: Request, res: Response, next: NextFunction) {
  return csrfProtection(req, res, next);
}

/**
 * Skip CSRF protection for specific routes
 */
export function skipCsrf(req: Request, res: Response, next: NextFunction) {
  (req as any).csrfSkip = true;
  next();
}

/**
 * Conditional CSRF middleware
 */
export function conditionalCsrf(req: Request, res: Response, next: NextFunction) {
  if ((req as any).csrfSkip) {
    return next();
  }
  return csrfProtection(req, res, next);
}

