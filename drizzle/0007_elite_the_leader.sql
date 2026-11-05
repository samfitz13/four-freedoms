CREATE TYPE "public"."transaction_kind" AS ENUM('cashflow', 'transfer');--> statement-breakpoint
ALTER TABLE "cashflow_transactions" ADD COLUMN "kind" "transaction_kind" DEFAULT 'cashflow' NOT NULL;--> statement-breakpoint
ALTER TABLE "cashflow_transactions" ADD COLUMN "transfer_group_id" text;--> statement-breakpoint
ALTER TABLE "cashflow_transactions" ADD COLUMN "transfer_peer_id" text;--> statement-breakpoint
CREATE INDEX "cashflow_household_kind_idx" ON "cashflow_transactions" USING btree ("household_id","kind");--> statement-breakpoint
CREATE INDEX "cashflow_transfer_group_idx" ON "cashflow_transactions" USING btree ("transfer_group_id");