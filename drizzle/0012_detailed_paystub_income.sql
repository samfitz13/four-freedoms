CREATE TYPE "public"."paystub_kind" AS ENUM('regular', 'bonus', 'rsu', 'correction', 'final');--> statement-breakpoint
ALTER TABLE "paystubs" ADD COLUMN "kind" "paystub_kind" DEFAULT 'regular' NOT NULL;--> statement-breakpoint
ALTER TABLE "paystubs" ADD COLUMN "federal_income_tax" numeric(18, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "paystubs" ADD COLUMN "social_security" numeric(18, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "paystubs" ADD COLUMN "medicare" numeric(18, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "paystubs" ADD COLUMN "additional_medicare" numeric(18, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "paystubs" ADD COLUMN "benefits" numeric(18, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "paystubs" ADD COLUMN "other_income" numeric(18, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "paystubs" ADD COLUMN "state_taxes" jsonb DEFAULT '[]'::jsonb NOT NULL;