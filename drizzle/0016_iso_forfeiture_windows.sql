ALTER TABLE "iso_option_grants" ADD COLUMN "employment_end_date" date;--> statement-breakpoint
ALTER TABLE "iso_option_grants" ADD COLUMN "post_termination_exercise_days" integer DEFAULT 90 NOT NULL;