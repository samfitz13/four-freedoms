CREATE TABLE "iso_option_exercises" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"grant_id" text NOT NULL,
	"exercise_date" date NOT NULL,
	"shares" integer NOT NULL,
	"exercise_price" numeric(18, 6),
	"fmv_at_exercise" numeric(18, 6),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "iso_option_grants" ADD COLUMN "vesting_start_date" date;--> statement-breakpoint
ALTER TABLE "iso_option_grants" ADD COLUMN "vesting_schedule" jsonb DEFAULT '{"type":"monthly","durationMonths":48,"cliffMonths":12}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "iso_option_exercises" ADD CONSTRAINT "iso_option_exercises_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iso_option_exercises" ADD CONSTRAINT "iso_option_exercises_grant_id_iso_option_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."iso_option_grants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "iso_option_exercises_household_idx" ON "iso_option_exercises" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "iso_option_exercises_grant_date_idx" ON "iso_option_exercises" USING btree ("grant_id","exercise_date");