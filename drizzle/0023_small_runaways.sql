CREATE TYPE "public"."habit_link_kind" AS ENUM('none', 'workout', 'sleep', 'body_weight');--> statement-breakpoint
CREATE TYPE "public"."sync_event_kind" AS ENUM('trip_time_event', 'connection_visit_time_event', 'residence_housing_budget', 'property_account_valuation', 'paystub_iso_employer');--> statement-breakpoint
CREATE TABLE "sync_events" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"kind" "sync_event_kind" NOT NULL,
	"source_id" text NOT NULL,
	"target_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cashflow_transactions" ADD COLUMN "trip_id" text;--> statement-breakpoint
ALTER TABLE "cashflow_transactions" ADD COLUMN "residence_id" text;--> statement-breakpoint
ALTER TABLE "connection_visits" ADD COLUMN "event_id" text;--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "link_kind" "habit_link_kind" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "link_params" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "paystubs" ADD COLUMN "work_pursuit_id" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "mortgage_account_id" text;--> statement-breakpoint
ALTER TABLE "time_events" ADD COLUMN "place_id" text;--> statement-breakpoint
ALTER TABLE "time_events" ADD COLUMN "connection_ids" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_events" ADD CONSTRAINT "sync_events_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sync_events_household_kind_idx" ON "sync_events" USING btree ("household_id","kind");--> statement-breakpoint
CREATE INDEX "sync_events_source_idx" ON "sync_events" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "sync_events_target_idx" ON "sync_events" USING btree ("target_id");--> statement-breakpoint
ALTER TABLE "cashflow_transactions" ADD CONSTRAINT "cashflow_transactions_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashflow_transactions" ADD CONSTRAINT "cashflow_transactions_residence_id_residences_id_fk" FOREIGN KEY ("residence_id") REFERENCES "public"."residences"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connection_visits" ADD CONSTRAINT "connection_visits_event_id_time_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."time_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paystubs" ADD CONSTRAINT "paystubs_work_pursuit_id_time_pursuits_id_fk" FOREIGN KEY ("work_pursuit_id") REFERENCES "public"."time_pursuits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_mortgage_account_id_financial_accounts_id_fk" FOREIGN KEY ("mortgage_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_events" ADD CONSTRAINT "time_events_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cashflow_household_trip_idx" ON "cashflow_transactions" USING btree ("household_id","trip_id");--> statement-breakpoint
CREATE INDEX "cashflow_household_residence_idx" ON "cashflow_transactions" USING btree ("household_id","residence_id");--> statement-breakpoint
CREATE INDEX "connection_visits_household_event_idx" ON "connection_visits" USING btree ("household_id","event_id");--> statement-breakpoint
CREATE INDEX "paystubs_household_work_pursuit_idx" ON "paystubs" USING btree ("household_id","work_pursuit_id");--> statement-breakpoint
CREATE INDEX "properties_household_mortgage_account_idx" ON "properties" USING btree ("household_id","mortgage_account_id");--> statement-breakpoint
CREATE INDEX "time_events_household_place_idx" ON "time_events" USING btree ("household_id","place_id");