CREATE TYPE "public"."residence_tenure" AS ENUM('rent', 'own', 'other');--> statement-breakpoint
ALTER TABLE "residences" ADD COLUMN "tenure" "residence_tenure" DEFAULT 'rent' NOT NULL;--> statement-breakpoint
ALTER TABLE "residences" ADD COLUMN "landlord" text;