CREATE TYPE "public"."entry_source" AS ENUM('manual', 'plaid', 'apple_health', 'google_calendar', 'import');--> statement-breakpoint
CREATE TYPE "public"."freedom" AS ENUM('financial', 'location', 'time', 'health');--> statement-breakpoint
CREATE TYPE "public"."goal_period" AS ENUM('weekly', 'monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."goal_status" AS ENUM('active', 'achieved', 'archived');--> statement-breakpoint
CREATE TABLE "entries" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"author_id" text NOT NULL,
	"freedom" "freedom" NOT NULL,
	"occurred_on" date NOT NULL,
	"payload" jsonb NOT NULL,
	"source" "entry_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "freedom_settings" (
	"household_id" text NOT NULL,
	"freedom" "freedom" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"target_json" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "freedom_settings_household_id_freedom_pk" PRIMARY KEY("household_id","freedom")
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"author_id" text NOT NULL,
	"freedom" "freedom" NOT NULL,
	"title" text NOT NULL,
	"target_json" jsonb,
	"period" "goal_period" DEFAULT 'weekly' NOT NULL,
	"status" "goal_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"author_id" text NOT NULL,
	"week_start" date NOT NULL,
	"reflections_json" jsonb NOT NULL,
	"overall_score" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freedom_settings" ADD CONSTRAINT "freedom_settings_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reviews" ADD CONSTRAINT "weekly_reviews_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reviews" ADD CONSTRAINT "weekly_reviews_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "entries_household_freedom_day_uq" ON "entries" USING btree ("household_id","freedom","occurred_on");--> statement-breakpoint
CREATE INDEX "entries_household_occurred_idx" ON "entries" USING btree ("household_id","occurred_on");--> statement-breakpoint
CREATE INDEX "entries_household_freedom_idx" ON "entries" USING btree ("household_id","freedom");--> statement-breakpoint
CREATE INDEX "goals_household_freedom_idx" ON "goals" USING btree ("household_id","freedom");--> statement-breakpoint
CREATE INDEX "goals_household_status_idx" ON "goals" USING btree ("household_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_reviews_household_week_uq" ON "weekly_reviews" USING btree ("household_id","week_start");