CREATE TABLE "iso_option_account_details" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"account_id" text NOT NULL,
	"employer_name" text NOT NULL,
	"employer_relationship" "employer_relationship" DEFAULT 'current' NOT NULL,
	"employment_end_date" date,
	"post_termination_exercise_days" integer DEFAULT 90 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "iso_option_account_details" ADD CONSTRAINT "iso_option_account_details_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iso_option_account_details" ADD CONSTRAINT "iso_option_account_details_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "iso_option_account_details_account_uq" ON "iso_option_account_details" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "iso_option_account_details_household_idx" ON "iso_option_account_details" USING btree ("household_id");