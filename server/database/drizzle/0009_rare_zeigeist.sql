ALTER TABLE "accounts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verifications" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "accounts" CASCADE;--> statement-breakpoint
DROP TABLE "sessions" CASCADE;--> statement-breakpoint
DROP TABLE "verifications" CASCADE;--> statement-breakpoint
DROP INDEX "users_external_user_id_key";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX "users_last_seen_at_idx" ON "users" USING btree ("last_seen_at");--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "email_verified";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "banned_until";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "confirmed_at";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "confirmation_sent_at";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "is_anonymous";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "is_sso_user";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "invited_at";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "last_sign_in_at";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "phone";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "raw_app_meta_data";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "raw_user_meta_data";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "providers";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_external_user_id_unique" UNIQUE("external_user_id");--> statement-breakpoint
DROP TYPE "public"."provider_enum";