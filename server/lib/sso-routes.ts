// import type { Express, Request, Response, NextFunction } from "express";
// import jwt, { type JwtPayload, type SignOptions } from "@gorth/mechanism/cores/jsonwebtoken";
// import { fromNodeHeaders } from "@gorth/structure/auth/server";
// import { v4 as uuidv4 } from "@gorth/structure/cores/uuid";

// import { auth } from "@/lib/auth";

// interface BetterAuthUser {
//   id: string;
//   email: string;
//   name: string;
//   image?: string | null;
//   emailVerified?: boolean;
//   updatedAt?: Date | string | null;
//   createdAt?: Date | string | null;
// }

// interface SsoAppContext {
//   id: string;
//   origin: string;
//   redirect_uri: string;
//   next?: string | null;
// }

// interface TokenBundleRequest {
//   app?: Partial<SsoAppContext>;
// }

// interface TokenVerifyRequest extends TokenBundleRequest {
//   access_token?: string;
//   refresh_token?: string;
// }

// interface GorthTokenPayload extends JwtPayload {
//   sub: string;
//   email: string;
//   sid?: string | null;
//   app?: string;
//   app_origin?: string;
//   typ?: "access" | "refresh";
// }

// type SsoUser = {
//   id: string;
//   aud: string;
//   email: string;
//   email_confirmed_at: string | null;
//   confirmed_at: string | null;
//   phone: null;
//   role: string;
//   updated_at: string | null;
//   created_at: string | null;
//   app_metadata: Record<string, unknown>;
//   user_metadata: Record<string, unknown>;
// };

// function normalizeOrigin(value: string | undefined | null) {
//   if (!value) {
//     return null;
//   }

//   try {
//     return new URL(value).origin;
//   } catch {
//     return null;
//   }
// }

// function toIsoString(value: Date | string | null | undefined) {
//   if (value instanceof Date) {
//     return value.toISOString();
//   }

//   return typeof value === "string" ? value : null;
// }

// function toSsoUser(user: BetterAuthUser): SsoUser {
//   const updatedAt = toIsoString(user.updatedAt);
//   const createdAt = toIsoString(user.createdAt);
//   const emailVerifiedAt = user.emailVerified ? updatedAt ?? createdAt : null;

//   return {
//     id: user.id,
//     aud: "authenticated",
//     email: user.email,
//     email_confirmed_at: emailVerifiedAt,
//     confirmed_at: emailVerifiedAt,
//     phone: null,
//     role: "authenticated",
//     updated_at: updatedAt,
//     created_at: createdAt,
//     app_metadata: {
//       provider: "better-auth",
//     },
//     user_metadata: {
//       name: user.name,
//       full_name: user.name,
//       avatar_url: user.image ?? null,
//       picture: user.image ?? null,
//     },
//   };
// }

// function toSsoUserFromToken(payload: GorthTokenPayload): SsoUser {
//   return {
//     id: payload.sub,
//     aud: "authenticated",
//     email: payload.email,
//     email_confirmed_at: null,
//     confirmed_at: null,
//     phone: null,
//     role: "authenticated",
//     updated_at: null,
//     created_at: null,
//     app_metadata: {
//       provider: "better-auth",
//     },
//     user_metadata: {},
//   };
// }

// function getRequiredSecret(name: string, fallback: string | undefined) {
//   const value = environment[name] ?? fallback;

//   if (!value) {
//     throw new Error(`Missing ${name}`);
//   }

//   return value;
// }

// function getIssuer(req: Request) {
//   return betterAuthUrl;
// }

// function getAppContext(req: Request): SsoAppContext {
//   const body = req.body as TokenBundleRequest;
//   const app = body.app ?? {};
//   const redirectUri = typeof app.redirect_uri === "string" ? app.redirect_uri : "";
//   const origin = normalizeOrigin(
//     typeof app.origin === "string" ? app.origin : redirectUri,
//   );

//   if (!redirectUri || !origin) {
//     throw Object.assign(new Error("invalid_app_context"), { statusCode: 400 });
//   }

//   return {
//     id:
//       typeof app.id === "string" && app.id.trim()
//         ? app.id.trim()
//         : origin,
//     origin,
//     redirect_uri: redirectUri,
//     next: typeof app.next === "string" ? app.next : null,
//   };
// }

// function getAppContextFromToken(req: Request, payload: GorthTokenPayload): SsoAppContext {
//   const body = req.body as TokenVerifyRequest;
//   const app = body.app ?? {};
//   const bodyRedirectUri = typeof app.redirect_uri === "string" ? app.redirect_uri : "";
//   const origin = normalizeOrigin(
//     typeof app.origin === "string" ? app.origin : bodyRedirectUri,
//   ) ?? normalizeOrigin(payload.app_origin);

//   if (!origin) {
//     throw Object.assign(new Error("invalid_app_context"), { statusCode: 400 });
//   }

//   return {
//     id:
//       typeof app.id === "string" && app.id.trim()
//         ? app.id.trim()
//         : payload.app ?? origin,
//     origin,
//     redirect_uri: bodyRedirectUri || origin,
//     next: typeof app.next === "string" ? app.next : null,
//   };
// }

// function getTokenSecrets() {
//   return {
//     accessTokenSecret: getRequiredSecret(
//       "GORTH_ACCESS_TOKEN_SECRET",
//       betterAuthSecret,
//     ),
//     refreshTokenSecret: getRequiredSecret(
//       "GORTH_REFRESH_TOKEN_SECRET",
//       betterAuthSecret,
//     ),
//   };
// }

// function assertSsoClient(req: Request) {
//   const expected = ssoOAuthClientId;

//   if (!expected) {
//     return;
//   }

//   if (req.get("x-sso-client-secret") !== expected) {
//     throw Object.assign(new Error("forbidden"), { statusCode: 403 });
//   }
// }

// function getExpiresIn(
//   name: string,
//   fallback: NonNullable<SignOptions["expiresIn"]>,
// ): NonNullable<SignOptions["expiresIn"]> {
//   return (environment[name] as NonNullable<SignOptions["expiresIn"]> | undefined) ?? fallback;
// }

// function signTokenPair(
//   req: Request,
//   user: SsoUser,
//   appContext: SsoAppContext,
//   sessionId: string | null,
// ) {
//   const issuer = getIssuer(req);
//   const { accessTokenSecret, refreshTokenSecret } = getTokenSecrets();
//   const tokenBasePayload = {
//     sub: user.id,
//     email: user.email,
//     sid: sessionId,
//     app: appContext.id,
//     app_origin: appContext.origin,
//   };

//   return {
//     access_token: jwt.sign(
//       {
//         ...tokenBasePayload,
//         typ: "access",
//       },
//       accessTokenSecret,
//       {
//         expiresIn: getExpiresIn("GORTH_ACCESS_TOKEN_EXPIRES_IN", "15m"),
//         issuer,
//         audience: appContext.id,
//         jwtid: uuidv4(),
//       },
//     ),
//     refresh_token: jwt.sign(
//       {
//         ...tokenBasePayload,
//         typ: "refresh",
//       },
//       refreshTokenSecret,
//       {
//         expiresIn: getExpiresIn("GORTH_REFRESH_TOKEN_EXPIRES_IN", "30d"),
//         issuer,
//         audience: appContext.id,
//         jwtid: uuidv4(),
//       },
//     ),
//   };
// }

// function assertTokenPayload(
//   payload: string | JwtPayload,
//   expectedType: GorthTokenPayload["typ"],
// ): GorthTokenPayload {
//   if (
//     typeof payload === "string" ||
//     typeof payload.sub !== "string" ||
//     typeof payload.email !== "string" ||
//     payload.typ !== expectedType
//   ) {
//     throw Object.assign(new Error("invalid_token"), { statusCode: 401 });
//   }

//   return payload as GorthTokenPayload;
// }

// function verifyToken(
//   token: string,
//   secret: string,
//   expectedType: GorthTokenPayload["typ"],
// ) {
//   return assertTokenPayload(jwt.verify(token, secret), expectedType);
// }

// function createTokenResponse(
//   req: Request,
//   user: SsoUser,
//   appContext: SsoAppContext,
//   sessionId: string | null,
// ) {
//   const tokens = signTokenPair(req, user, appContext, sessionId);

//   return {
//     user,
//     sso_sub: user.id,
//     email: user.email,
//     ...tokens,
//     gorth_app: {
//       ...appContext,
//       issued_at: Date.now(),
//     },
//   };
// }

// export function registerSsoRoutes(app: Express) {
//   app.post(
//     "/internal/sso/token-bundle",
//     async (req: Request, res: Response, next: NextFunction) => {
//       try {
//         assertSsoClient(req);

//         const session = await auth.api.getSession({
//           headers: fromNodeHeaders(req.headers),
//         });

//         if (!session?.user?.email) {
//           res.status(401).json({ error: "unauthorized" });
//           return;
//         }

//         const appContext = getAppContext(req);
//         const user = toSsoUser(session.user);
//         const sessionId =
//           "session" in session &&
//           session.session &&
//           typeof session.session.id === "string"
//             ? session.session.id
//             : null;

//         res.status(200).json(createTokenResponse(req, user, appContext, sessionId));
//       } catch (error) {
//         next(error);
//       }
//     },
//   );

//   app.post(
//     "/internal/sso/verify-token",
//     async (req: Request, res: Response, next: NextFunction) => {
//       try {
//         assertSsoClient(req);

//         const body = req.body as TokenVerifyRequest;
//         const accessToken = typeof body.access_token === "string" ? body.access_token : "";
//         const refreshToken = typeof body.refresh_token === "string" ? body.refresh_token : "";
//         const { accessTokenSecret, refreshTokenSecret } = getTokenSecrets();

//         if (!accessToken && !refreshToken) {
//           res.status(401).json({ error: "missing_token" });
//           return;
//         }

//         try {
//           const accessPayload = verifyToken(accessToken, accessTokenSecret, "access");
//           const appContext = getAppContextFromToken(req, accessPayload);
//           const user = toSsoUserFromToken(accessPayload);

//           res.status(200).json({
//             user,
//             sso_sub: user.id,
//             email: user.email,
//             access_token: accessToken,
//             refresh_token: refreshToken,
//             gorth_app: {
//               ...appContext,
//               issued_at: Date.now(),
//             },
//           });
//           return;
//         } catch (error) {
//           if (!(error instanceof jwt.TokenExpiredError) || !refreshToken) {
//             throw error;
//           }
//         }

//         const refreshPayload = verifyToken(refreshToken, refreshTokenSecret, "refresh");
//         const appContext = getAppContextFromToken(req, refreshPayload);
//         const user = toSsoUserFromToken(refreshPayload);

//         res
//           .status(200)
//           .json(createTokenResponse(req, user, appContext, refreshPayload.sid ?? null));
//       } catch (error) {
//         next(error);
//       }
//     },
//   );
// }
