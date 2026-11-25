import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { rawReadAppIdentity, rawReadAppCredentials } from "@/models/session";
import { formatPublicSession } from "@/utils/formatter";

export const readSession = cache(async (fresh = false) => {
  const incoming = new Headers(await headers());
  const identity = await rawReadAppIdentity(incoming);
  if (!identity) return null;
  if (fresh || identity.user.syncedAt.getTime() <= Date.now() - 120_000) {
    const credentials = await rawReadAppCredentials(incoming, true);
    return credentials ? formatPublicSession(credentials) : null;
  }
  return identity ? formatPublicSession(identity) : null;
});
export async function verifySession(fresh = false) {
  const session = await readSession(fresh);
  return session
    ? {
        user: session.user,
        sso_sub: session.user.id,
        email: session.user.email,
        expires_at: session.expiresAt,
      }
    : null;
}
export const getUser = cache(
  async (fresh = false) => (await readSession(fresh))?.user ?? null,
);
