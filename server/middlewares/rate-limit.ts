// import { Request, Response, NextFunction } from "express";
// import { 
//   authRateLimit, 
//   apiRateLimit, 
//   strictRateLimit, 
//   mfaRateLimit, 
//   passwordResetRateLimit, 
//   otpRateLimit 
// } from "@/services/rate-limit";

// /**
//  * Rate limiting middleware for different endpoints
//  */

// // Auth endpoints - strict rate limiting
// export const authRateLimitMiddleware = authRateLimit;
// export const authRateLimiter = authRateLimit;

// // API endpoints - moderate rate limiting
// export const apiRateLimitMiddleware = apiRateLimit;

// // Strict endpoints - very strict rate limiting
// export const strictRateLimitMiddleware = strictRateLimit;
// export const strictRateLimiter = strictRateLimit;

// // MFA endpoints - moderate rate limiting
// export const mfaRateLimitMiddleware = mfaRateLimit;

// // Password reset - strict rate limiting
// export const passwordResetRateLimitMiddleware = passwordResetRateLimit;

// // OTP endpoints - very strict rate limiting
// export const otpRateLimitMiddleware = otpRateLimit;

// // Email verification rate limiting
// export const emailVerificationRateLimiter = passwordResetRateLimit;

// /**
//  * Dynamic rate limiting based on user role
//  */
// export function dynamicRateLimit(req: Request, res: Response, next: NextFunction) {
//   const user = (req as any).dbUser;
  
//   if (!user) {
//     return apiRateLimitMiddleware(req, res, next);
//   }

//   // Super admins have higher limits
//   if (user.role === "master") {
//     return next(); // No rate limiting for super admins
//   }

//   // Admins have moderate limits
//   if (user.role === "admin") {
//     return strictRateLimitMiddleware(req, res, next);
//   }

//   // Regular users have standard limits
//   return apiRateLimitMiddleware(req, res, next);
// }
