CREATE TYPE "public"."calendar_provider" AS ENUM('google');--> statement-breakpoint
CREATE TYPE "public"."event_exception_action" AS ENUM('moved', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."event_source" AS ENUM('native', 'google');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('confirmed', 'tentative', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."habit_cadence" AS ENUM('daily', 'weekly', 'custom');--> statement-breakpoint
CREATE TYPE "public"."pursuit_kind" AS ENUM('work', 'play', 'care', 'rest', 'admin');--> statement-breakpoint
CREATE TABLE "calendar_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"provider" "calendar_provider" DEFAULT 'google' NOT NULL,
	"external_account_id" text NOT NULL,
	"display_email" text,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"access_token_expires_at" timestamp with time zone,
	"sync_token" text,
	"last_synced_at" timestamp with time zone,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habit_checkins" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"habit_id" text NOT NULL,
	"occurred_on" date NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habits" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"title" text NOT NULL,
	"pursuit_id" text,
	"cadence" "habit_cadence" DEFAULT 'daily' NOT NULL,
	"target_per_week" integer DEFAULT 7 NOT NULL,
	"time_of_day" text,
	"started_on" date NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_event_exceptions" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"occurrence_starts_at" timestamp with time zone NOT NULL,
	"action" "event_exception_action" NOT NULL,
	"new_starts_at" timestamp with time zone,
	"new_ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_events" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"source" "event_source" DEFAULT 'native' NOT NULL,
	"external_id" text,
	"calendar_account_id" text,
	"title" text NOT NULL,
	"location" text,
	"description" text,
	"pursuit_id" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"rrule" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"status" "event_status" DEFAULT 'confirmed' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_log_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"pursuit_id" text NOT NULL,
	"recorded_on" date NOT NULL,
	"hours" numeric(5, 2) NOT NULL,
	"note" text,
	"source" "entry_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_pursuits" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" "pursuit_kind" DEFAULT 'work' NOT NULL,
	"color_var" text DEFAULT 'var(--color-freedom-time)' NOT NULL,
	"matters" boolean DEFAULT true NOT NULL,
	"weekly_target_hours" numeric(5, 2),
	"system_key" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_accounts" ADD CONSTRAINT "calendar_accounts_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_checkins" ADD CONSTRAINT "habit_checkins_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_checkins" ADD CONSTRAINT "habit_checkins_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_pursuit_id_time_pursuits_id_fk" FOREIGN KEY ("pursuit_id") REFERENCES "public"."time_pursuits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_event_exceptions" ADD CONSTRAINT "time_event_exceptions_event_id_time_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."time_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_events" ADD CONSTRAINT "time_events_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_events" ADD CONSTRAINT "time_events_calendar_account_id_calendar_accounts_id_fk" FOREIGN KEY ("calendar_account_id") REFERENCES "public"."calendar_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_events" ADD CONSTRAINT "time_events_pursuit_id_time_pursuits_id_fk" FOREIGN KEY ("pursuit_id") REFERENCES "public"."time_pursuits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_log_entries" ADD CONSTRAINT "time_log_entries_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_log_entries" ADD CONSTRAINT "time_log_entries_pursuit_id_time_pursuits_id_fk" FOREIGN KEY ("pursuit_id") REFERENCES "public"."time_pursuits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_pursuits" ADD CONSTRAINT "time_pursuits_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_accounts_household_provider_external_uq" ON "calendar_accounts" USING btree ("household_id","provider","external_account_id");--> statement-breakpoint
CREATE INDEX "calendar_accounts_household_idx" ON "calendar_accounts" USING btree ("household_id");--> statement-breakpoint
CREATE UNIQUE INDEX "habit_checkins_household_habit_day_uq" ON "habit_checkins" USING btree ("household_id","habit_id","occurred_on");--> statement-breakpoint
CREATE INDEX "habit_checkins_household_day_idx" ON "habit_checkins" USING btree ("household_id","occurred_on");--> statement-breakpoint
CREATE INDEX "habits_household_idx" ON "habits" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "time_event_exceptions_event_idx" ON "time_event_exceptions" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "time_events_household_source_external_uq" ON "time_events" USING btree ("household_id","source","external_id");--> statement-breakpoint
CREATE INDEX "time_events_household_starts_idx" ON "time_events" USING btree ("household_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "time_log_entries_household_pursuit_day_uq" ON "time_log_entries" USING btree ("household_id","pursuit_id","recorded_on");--> statement-breakpoint
CREATE INDEX "time_log_entries_household_day_idx" ON "time_log_entries" USING btree ("household_id","recorded_on");--> statement-breakpoint
CREATE UNIQUE INDEX "time_pursuits_household_name_uq" ON "time_pursuits" USING btree ("household_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "time_pursuits_household_system_key_uq" ON "time_pursuits" USING btree ("household_id","system_key");--> statement-breakpoint
CREATE INDEX "time_pursuits_household_kind_idx" ON "time_pursuits" USING btree ("household_id","kind");