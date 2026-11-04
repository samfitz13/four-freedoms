DROP TABLE "account_balances" CASCADE;--> statement-breakpoint
DROP TABLE "account_reconciliations" CASCADE;--> statement-breakpoint
DROP TABLE "holding_prices" CASCADE;--> statement-breakpoint
DROP TABLE "holdings" CASCADE;--> statement-breakpoint
DROP TABLE "plaid_items" CASCADE;--> statement-breakpoint
ALTER TABLE "financial_accounts" DROP COLUMN "external_id";--> statement-breakpoint
ALTER TABLE "financial_accounts" DROP COLUMN "plaid_item_id";--> statement-breakpoint
DROP TYPE "public"."holding_asset_class";