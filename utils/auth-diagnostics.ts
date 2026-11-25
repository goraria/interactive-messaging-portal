import "server-only";
import { APIError } from "better-auth";
import { AuthError } from "@gorth-com/structure/modules/auth/server";

// Exceptions can contain tokens, connection strings and full SQL. Log only
// bounded machine codes and an app-owned stage, never messages or raw errors.
export function logAuthFailure(error: unknown, stage: string) {
  const value = error && typeof error === "object" ? error : {};
  const cause =
    "cause" in value && value.cause && typeof value.cause === "object"
      ? value.cause
      : {};
  const code =
    error instanceof AuthError
      ? `AUTH_${error.code.toUpperCase()}`
      : error instanceof APIError
        ? error.body?.code
        : "code" in value
          ? value.code
          : undefined;
  const databaseCode = "code" in cause ? cause.code : undefined;
  const safeCode = (input: unknown) =>
    typeof input === "string" && /^[A-Z0-9_]{1,64}$/.test(input)
      ? input
      : undefined;
  console.error("[auth/session]", {
    stage,
    code: safeCode(code),
    databaseCode: safeCode(databaseCode),
    status: error instanceof APIError ? error.statusCode : undefined,
  });
}
