CREATE TABLE IF NOT EXISTS "rate_limit" (
  "key" text PRIMARY KEY NOT NULL,
  "count" integer DEFAULT 0 NOT NULL,
  "last_request" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sso_dpop_replay" (
  "key" text PRIMARY KEY NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sso_dpop_replay_expires_at_idx"
  ON "sso_dpop_replay" USING btree ("expires_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sso_revoked_session" (
  "jti" text PRIMARY KEY NOT NULL,
  "sid" text NOT NULL,
  "subject" text,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sso_revoked_session_sid_idx"
  ON "sso_revoked_session" USING btree ("sid");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sso_revoked_session_expires_at_idx"
  ON "sso_revoked_session" USING btree ("expires_at");
