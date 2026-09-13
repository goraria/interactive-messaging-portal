CREATE TYPE "public"."user_status" AS ENUM('active', 'inactive', 'suspended', 'deleted');--> statement-breakpoint
ALTER TABLE "conversation_members" RENAME TO "conversation_member";--> statement-breakpoint
ALTER TABLE "conversations" RENAME TO "conversation";--> statement-breakpoint
ALTER TABLE "message_attachments" RENAME TO "message_attachment";--> statement-breakpoint
ALTER TABLE "message_reactions" RENAME TO "message_reaction";--> statement-breakpoint
ALTER TABLE "message_receipts" RENAME TO "message_receipt";--> statement-breakpoint
ALTER TABLE "messages" RENAME TO "message";--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "banned_until" TO "ban_expires";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_username_unique";--> statement-breakpoint
ALTER TABLE "conversation_member" DROP CONSTRAINT "conversation_members_conversation_id_conversations_id_fk";
--> statement-breakpoint
ALTER TABLE "conversation_member" DROP CONSTRAINT "conversation_members_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "conversation_member" DROP CONSTRAINT "conversation_members_last_read_message_id_messages_id_fk";
--> statement-breakpoint
ALTER TABLE "conversation" DROP CONSTRAINT "conversations_created_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "message_attachment" DROP CONSTRAINT "message_attachments_message_id_messages_id_fk";
--> statement-breakpoint
ALTER TABLE "message_reaction" DROP CONSTRAINT "message_reactions_message_id_messages_id_fk";
--> statement-breakpoint
ALTER TABLE "message_reaction" DROP CONSTRAINT "message_reactions_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "message_receipt" DROP CONSTRAINT "message_receipts_message_id_messages_id_fk";
--> statement-breakpoint
ALTER TABLE "message_receipt" DROP CONSTRAINT "message_receipts_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "message" DROP CONSTRAINT "messages_conversation_id_conversations_id_fk";
--> statement-breakpoint
ALTER TABLE "message" DROP CONSTRAINT "messages_sender_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "conversation_members_user_id_idx";--> statement-breakpoint
DROP INDEX "conversation_members_last_read_message_id_idx";--> statement-breakpoint
DROP INDEX "conversations_slug_key";--> statement-breakpoint
DROP INDEX "conversations_created_by_id_idx";--> statement-breakpoint
DROP INDEX "message_attachments_message_id_idx";--> statement-breakpoint
DROP INDEX "message_reactions_message_user_emoji_key";--> statement-breakpoint
DROP INDEX "message_reactions_user_id_idx";--> statement-breakpoint
DROP INDEX "message_receipts_message_user_key";--> statement-breakpoint
DROP INDEX "message_receipts_user_status_idx";--> statement-breakpoint
DROP INDEX "messages_conversation_created_at_idx";--> statement-breakpoint
DROP INDEX "messages_sender_id_idx";--> statement-breakpoint
DROP INDEX "messages_deleted_at_idx";--> statement-breakpoint
DROP INDEX "users_last_seen_at_idx";--> statement-breakpoint
DROP INDEX "users_external_user_id_idx";--> statement-breakpoint
ALTER TABLE "conversation_member" DROP CONSTRAINT "conversation_members_pk";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "username" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "last_seen_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "synced_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "synced_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "conversation_member" ADD CONSTRAINT "conversation_member_pk" PRIMARY KEY("conversation_id","user_id");--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" "user_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "banned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conversation_member" ADD CONSTRAINT "conversation_member_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_member" ADD CONSTRAINT "conversation_member_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_member" ADD CONSTRAINT "conversation_member_last_read_message_id_message_id_fk" FOREIGN KEY ("last_read_message_id") REFERENCES "public"."message"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachment" ADD CONSTRAINT "message_attachment_message_id_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reaction" ADD CONSTRAINT "message_reaction_message_id_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reaction" ADD CONSTRAINT "message_reaction_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_receipt" ADD CONSTRAINT "message_receipt_message_id_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_receipt" ADD CONSTRAINT "message_receipt_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_member_user_id_idx" ON "conversation_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "conversation_member_last_read_message_id_idx" ON "conversation_member" USING btree ("last_read_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_slug_key" ON "conversation" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "conversation_created_by_id_idx" ON "conversation" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "message_attachment_message_id_idx" ON "message_attachment" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_reaction_message_user_emoji_key" ON "message_reaction" USING btree ("message_id","user_id","emoji");--> statement-breakpoint
CREATE INDEX "message_reaction_user_id_idx" ON "message_reaction" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_receipt_message_user_key" ON "message_receipt" USING btree ("message_id","user_id");--> statement-breakpoint
CREATE INDEX "message_receipt_user_status_idx" ON "message_receipt" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "message_conversation_created_at_idx" ON "message" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "message_sender_id_idx" ON "message" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "message_deleted_at_idx" ON "message" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "user_last_seen_at_idx" ON "users" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "user_external_user_id_idx" ON "users" USING btree ("external_user_id");--> statement-breakpoint
CREATE INDEX "user_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "user_username_lower_key" ON "users" USING btree (lower("username"));