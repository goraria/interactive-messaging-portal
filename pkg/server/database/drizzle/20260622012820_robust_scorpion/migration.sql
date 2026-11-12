CREATE TYPE "public"."provider_enum" AS ENUM('google', 'github', 'facebook', 'credentials');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "providers" SET DEFAULT '{}'::"public"."provider_enum"[];--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "providers" SET DATA TYPE "public"."provider_enum"[] USING "providers"::"public"."provider_enum"[];