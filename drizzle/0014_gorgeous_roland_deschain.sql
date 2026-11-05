CREATE TYPE "public"."employer_relationship" AS ENUM('current', 'former');--> statement-breakpoint
ALTER TYPE "public"."account_type" ADD VALUE 'iso_options' BEFORE 'other';--> statement-breakpoint
CREATE TABLE "iso_option_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"account_id" text NOT NULL,
	"employer_name" text NOT NULL,
	"employer_relationship" "employer_relationship" NOT NULL,
	"label" text NOT NULL,
	"grant_date" date,
	"expiration_date" date,
	"total_shares" integer NOT NULL,
	"strike_price" numeric(18, 6) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iso_option_valuations" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"account_id" text NOT NULL,
	"as_of" date NOT NULL,
	"fmv" numeric(18, 6) NOT NULL,
	"share_price" numeric(18, 6),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iso_option_vesting_events" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"grant_id" text NOT NULL,
	"vest_date" date NOT NULL,
	"shares" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "iso_option_grants" ADD CONSTRAINT "iso_option_grants_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iso_option_grants" ADD CONSTRAINT "iso_option_grants_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iso_option_valuations" ADD CONSTRAINT "iso_option_valuations_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iso_option_valuations" ADD CONSTRAINT "iso_option_valuations_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iso_option_vesting_events" ADD CONSTRAINT "iso_option_vesting_events_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iso_option_vesting_events" ADD CONSTRAINT "iso_option_vesting_events_grant_id_iso_option_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."iso_option_grants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "iso_option_grants_household_idx" ON "iso_option_grants" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "iso_option_grants_account_idx" ON "iso_option_grants" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "iso_option_valuations_household_idx" ON "iso_option_valuations" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "iso_option_valuations_account_as_of_idx" ON "iso_option_valuations" USING btree ("account_id","as_of");--> statement-breakpoint
CREATE INDEX "iso_option_vesting_events_household_idx" ON "iso_option_vesting_events" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "iso_option_vesting_events_grant_date_idx" ON "iso_option_vesting_events" USING btree ("grant_id","vest_date");