CREATE TABLE "health_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"recorded_on" date NOT NULL,
	"sleep_hours" numeric(4, 2),
	"trained" boolean DEFAULT false NOT NULL,
	"energy" integer,
	"resting_hr" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location_satisfactions" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"recorded_on" date NOT NULL,
	"place_id" text,
	"satisfaction" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"name" text NOT NULL,
	"country" text,
	"lat" numeric(9, 6),
	"lng" numeric(9, 6),
	"is_preferred" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stays" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"place_id" text NOT NULL,
	"started_on" date NOT NULL,
	"ended_on" date,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"recorded_on" date NOT NULL,
	"deep_work_hours" numeric(5, 2) DEFAULT '0' NOT NULL,
	"meeting_hours" numeric(5, 2) DEFAULT '0' NOT NULL,
	"obligation_hours" numeric(5, 2) DEFAULT '0' NOT NULL,
	"priority_split" numeric(4, 3),
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "health_logs" ADD CONSTRAINT "health_logs_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_satisfactions" ADD CONSTRAINT "location_satisfactions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_satisfactions" ADD CONSTRAINT "location_satisfactions_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stays" ADD CONSTRAINT "stays_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stays" ADD CONSTRAINT "stays_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_blocks" ADD CONSTRAINT "time_blocks_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "health_logs_household_day_uq" ON "health_logs" USING btree ("household_id","recorded_on");--> statement-breakpoint
CREATE INDEX "health_logs_household_day_idx" ON "health_logs" USING btree ("household_id","recorded_on");--> statement-breakpoint
CREATE UNIQUE INDEX "location_satisfactions_household_day_uq" ON "location_satisfactions" USING btree ("household_id","recorded_on");--> statement-breakpoint
CREATE INDEX "location_satisfactions_household_day_idx" ON "location_satisfactions" USING btree ("household_id","recorded_on");--> statement-breakpoint
CREATE UNIQUE INDEX "places_household_name_country_uq" ON "places" USING btree ("household_id","name","country");--> statement-breakpoint
CREATE INDEX "places_household_idx" ON "places" USING btree ("household_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stays_household_place_started_uq" ON "stays" USING btree ("household_id","place_id","started_on");--> statement-breakpoint
CREATE INDEX "stays_household_started_idx" ON "stays" USING btree ("household_id","started_on");--> statement-breakpoint
CREATE UNIQUE INDEX "time_blocks_household_day_uq" ON "time_blocks" USING btree ("household_id","recorded_on");--> statement-breakpoint
CREATE INDEX "time_blocks_household_day_idx" ON "time_blocks" USING btree ("household_id","recorded_on");