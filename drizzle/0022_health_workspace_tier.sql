CREATE TYPE "public"."workout_kind" AS ENUM('strength', 'cardio', 'mobility', 'sport', 'other');--> statement-breakpoint
CREATE TABLE "sleep_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"recorded_on" date NOT NULL,
	"sleep_hours" numeric(4, 2) NOT NULL,
	"bed_at" time,
	"wake_at" time,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_checkins" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"energy" integer,
	"resting_hr" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"performed_at" timestamp with time zone NOT NULL,
	"kind" "workout_kind" DEFAULT 'other' NOT NULL,
	"minutes" integer NOT NULL,
	"intensity" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "body_measurements" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"weight_kg" numeric(5, 2),
	"body_fat_pct" numeric(5, 2),
	"waist_cm" numeric(5, 2),
	"resting_hr" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sleep_logs" ADD CONSTRAINT "sleep_logs_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_checkins" ADD CONSTRAINT "health_checkins_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "body_measurements" ADD CONSTRAINT "body_measurements_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "sleep_logs" ("id", "household_id", "recorded_on", "sleep_hours", "note", "created_at")
SELECT "id", "household_id", "recorded_on", "sleep_hours", "note", "created_at"
FROM "health_logs"
WHERE "sleep_hours" IS NOT NULL;--> statement-breakpoint
INSERT INTO "health_checkins" ("id", "household_id", "recorded_at", "energy", "resting_hr", "note", "created_at")
SELECT "id", "household_id", ("recorded_on"::timestamp + time '12:00'), "energy", "resting_hr", "note", "created_at"
FROM "health_logs"
WHERE "energy" IS NOT NULL OR "resting_hr" IS NOT NULL OR "note" IS NOT NULL;--> statement-breakpoint
INSERT INTO "workouts" ("id", "household_id", "performed_at", "kind", "minutes", "note", "created_at")
SELECT "id", "household_id", ("recorded_on"::timestamp + time '12:00'), 'other', 30, 'Migrated trained flag.', "created_at"
FROM "health_logs"
WHERE "trained" = true;--> statement-breakpoint
CREATE INDEX "sleep_logs_household_day_idx" ON "sleep_logs" USING btree ("household_id","recorded_on");--> statement-breakpoint
CREATE INDEX "health_checkins_household_recorded_idx" ON "health_checkins" USING btree ("household_id","recorded_at" DESC);--> statement-breakpoint
CREATE INDEX "workouts_household_performed_idx" ON "workouts" USING btree ("household_id","performed_at" DESC);--> statement-breakpoint
CREATE INDEX "body_measurements_household_recorded_idx" ON "body_measurements" USING btree ("household_id","recorded_at" DESC);--> statement-breakpoint
DROP TABLE "health_logs";