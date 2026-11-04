CREATE TYPE "public"."connection_cadence" AS ENUM('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."connection_kind" AS ENUM('family', 'friend', 'partner', 'community', 'neighbor', 'mentor', 'other');--> statement-breakpoint
CREATE TYPE "public"."property_use" AS ENUM('owner_occupied', 'second_home', 'rental', 'investment', 'other');--> statement-breakpoint
CREATE TYPE "public"."residence_role" AS ENUM('primary', 'secondary', 'former');--> statement-breakpoint
CREATE TYPE "public"."stay_kind" AS ENUM('residence', 'trip', 'visit', 'other');--> statement-breakpoint
CREATE TYPE "public"."trip_purpose" AS ENUM('vacation', 'family', 'work', 'medical', 'retreat', 'other');--> statement-breakpoint
CREATE TABLE "connection_visits" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"occurred_on" date NOT NULL,
	"place_id" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" "connection_kind" NOT NULL,
	"place_id" text,
	"cadence" "connection_cadence",
	"last_seen_on" date,
	"note" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"place_id" text NOT NULL,
	"account_id" text NOT NULL,
	"use" "property_use" NOT NULL,
	"ownership_pct" numeric(5, 2) DEFAULT '100' NOT NULL,
	"acquired_on" date NOT NULL,
	"disposed_on" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "residences" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"place_id" text NOT NULL,
	"role" "residence_role" NOT NULL,
	"started_on" date NOT NULL,
	"ended_on" date,
	"household_share_pct" numeric(5, 2) DEFAULT '100' NOT NULL,
	"cost_per_month" numeric(18, 2),
	"currency" text DEFAULT 'USD' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"name" text NOT NULL,
	"purpose" "trip_purpose" NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"budget_amount" numeric(18, 2),
	"currency" text DEFAULT 'USD' NOT NULL,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "location_satisfactions" ADD COLUMN "with_connection_ids" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "stays" ADD COLUMN "kind" "stay_kind" DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "stays" ADD COLUMN "trip_id" text;--> statement-breakpoint
ALTER TABLE "connection_visits" ADD CONSTRAINT "connection_visits_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connection_visits" ADD CONSTRAINT "connection_visits_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connection_visits" ADD CONSTRAINT "connection_visits_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "residences" ADD CONSTRAINT "residences_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "residences" ADD CONSTRAINT "residences_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "connection_visits_household_occurred_idx" ON "connection_visits" USING btree ("household_id","occurred_on");--> statement-breakpoint
CREATE INDEX "connections_household_place_idx" ON "connections" USING btree ("household_id","place_id");--> statement-breakpoint
CREATE INDEX "connections_household_kind_idx" ON "connections" USING btree ("household_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "properties_household_account_uq" ON "properties" USING btree ("household_id","account_id");--> statement-breakpoint
CREATE INDEX "properties_household_use_idx" ON "properties" USING btree ("household_id","use");--> statement-breakpoint
CREATE INDEX "residences_household_role_idx" ON "residences" USING btree ("household_id","role");--> statement-breakpoint
CREATE INDEX "residences_household_started_idx" ON "residences" USING btree ("household_id","started_on");--> statement-breakpoint
CREATE INDEX "trips_household_starts_idx" ON "trips" USING btree ("household_id","starts_on");--> statement-breakpoint
ALTER TABLE "stays" ADD CONSTRAINT "stays_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stays_household_trip_idx" ON "stays" USING btree ("household_id","trip_id");