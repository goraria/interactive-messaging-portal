-- Auth contract cloud push applied on 2026-10-09.
-- Audit record only: already pushed; not a Drizzle migration-ledger entry.
-- Historical snapshots remain immutable. Do not replay into a pushed DB.
BEGIN;

ALTER TABLE "public"."sso_revoked_session" RENAME TO "revocation";

ALTER TABLE "public"."sso_dpop_replay" RENAME TO "proof";

ALTER TABLE "public"."proof" RENAME CONSTRAINT "sso_dpop_replay_pkey" TO "proof_pkey";

ALTER TABLE "public"."revocation" RENAME CONSTRAINT "sso_revoked_session_pkey" TO "revocation_pkey";

CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"token_hash" text NOT NULL,
	"credentials" text,
	"sso_session_id" text,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE "verification" (
	"state_hash" text PRIMARY KEY,
	"expires_at" timestamp with time zone NOT NULL
);


ALTER TABLE "revocation" ALTER COLUMN "sid" DROP NOT NULL;

CREATE UNIQUE INDEX "session_token_hash_unique" ON "session" ("token_hash");

CREATE INDEX "session_user_index" ON "session" ("user_id");

CREATE INDEX "session_sso_session_index" ON "session" ("sso_session_id");

CREATE INDEX "session_expires_idx" ON "session" ("expires_at");

CREATE INDEX "verification_expires_idx" ON "verification" ("expires_at");

CREATE INDEX "revocation_sid_idx" ON "revocation" ("sid");

CREATE INDEX "revocation_expires_idx" ON "revocation" ("expires_at");

CREATE INDEX "proof_expires_idx" ON "proof" ("expires_at");

ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;

COMMIT;

-- Follow-up: normalize legacy NOT NULL, UNIQUE and FK constraint names.
BEGIN;

ALTER TABLE "public"."proof" RENAME CONSTRAINT "sso_dpop_replay_expires_at_not_null" TO "proof_expires_at_not_null";

ALTER TABLE "public"."proof" RENAME CONSTRAINT "sso_dpop_replay_key_not_null" TO "proof_key_not_null";

ALTER TABLE "public"."revocation" RENAME CONSTRAINT "sso_revoked_session_created_at_not_null" TO "revocation_created_at_not_null";

ALTER TABLE "public"."revocation" RENAME CONSTRAINT "sso_revoked_session_expires_at_not_null" TO "revocation_expires_at_not_null";

ALTER TABLE "public"."revocation" RENAME CONSTRAINT "sso_revoked_session_jti_not_null" TO "revocation_jti_not_null";

COMMIT;
