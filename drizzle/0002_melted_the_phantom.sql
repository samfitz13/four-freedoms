CREATE TYPE "public"."account_type" AS ENUM('checking', 'savings', 'brokerage', 'retirement', 'crypto', 'real_estate', 'loan', 'credit_card', 'other');--> statement-breakpoint
CREATE TYPE "public"."budget_category_kind" AS ENUM('income', 'fixed', 'variable', 'savings', 'debt');--> statement-breakpoint
CREATE TYPE "public"."csv_import_kind" AS ENUM('accounts', 'transactions', 'holdings');--> statement-breakpoint
CREATE TYPE "public"."csv_import_status" AS ENUM('pending', 'succeeded', 'failed', 'partial');--> statement-breakpoint
CREATE TYPE "public"."financial_goal_kind" AS ENUM('fi_number', 'net_worth_target', 'savings_milestone', 'debt_payoff', 'emergency_fund');--> statement-breakpoint
CREATE TYPE "public"."holding_asset_class" AS ENUM('cash', 'equity', 'fixed_income', 'crypto', 'real_estate', 'alt', 'other');--> statement-breakpoint
CREATE TABLE "account_balances" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"as_of" date NOT NULL,
	"balance" numeric(18, 2) NOT NULL,
	"source" "entry_source" DEFAULT 'manual' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" "budget_category_kind" DEFAULT 'variable' NOT NULL,
	"color_var" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_periods" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"category_id" text NOT NULL,
	"month" date NOT NULL,
	"planned_amount" numeric(18, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cashflow_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"account_id" text,
	"occurred_on" date NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"description" text,
	"category_id" text,
	"source" "entry_source" DEFAULT 'manual' NOT NULL,
	"external_id" text,
	"import_batch_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "csv_imports" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"author_id" text NOT NULL,
	"kind" "csv_import_kind" NOT NULL,
	"filename" text NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"status" "csv_import_status" DEFAULT 'pending' NOT NULL,
	"error_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"name" text NOT NULL,
	"type" "account_type" NOT NULL,
	"subtype" text,
	"currency" text DEFAULT 'USD' NOT NULL,
	"institution" text,
	"is_manual" boolean DEFAULT true NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"external_id" text,
	"plaid_item_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_goals" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"kind" "financial_goal_kind" NOT NULL,
	"title" text NOT NULL,
	"target_amount" numeric(18, 2),
	"target_date" date,
	"params" jsonb,
	"status" "goal_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holding_prices" (
	"id" text PRIMARY KEY NOT NULL,
	"holding_id" text NOT NULL,
	"as_of" date NOT NULL,
	"price" numeric(18, 6) NOT NULL,
	"source" "entry_source" DEFAULT 'manual' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holdings" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"symbol" text NOT NULL,
	"name" text,
	"asset_class" "holding_asset_class" DEFAULT 'equity' NOT NULL,
	"quantity" numeric(24, 8) NOT NULL,
	"cost_basis" numeric(18, 2),
	"currency" text DEFAULT 'USD' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_balances" ADD CONSTRAINT "account_balances_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_categories" ADD CONSTRAINT "budget_categories_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_periods" ADD CONSTRAINT "budget_periods_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_periods" ADD CONSTRAINT "budget_periods_category_id_budget_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."budget_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashflow_transactions" ADD CONSTRAINT "cashflow_transactions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashflow_transactions" ADD CONSTRAINT "cashflow_transactions_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "csv_imports" ADD CONSTRAINT "csv_imports_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "csv_imports" ADD CONSTRAINT "csv_imports_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_goals" ADD CONSTRAINT "financial_goals_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding_prices" ADD CONSTRAINT "holding_prices_holding_id_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."holdings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_balances_account_asof_uq" ON "account_balances" USING btree ("account_id","as_of");--> statement-breakpoint
CREATE INDEX "account_balances_account_asof_idx" ON "account_balances" USING btree ("account_id","as_of");--> statement-breakpoint
CREATE UNIQUE INDEX "budget_categories_household_name_uq" ON "budget_categories" USING btree ("household_id","name");--> statement-breakpoint
CREATE INDEX "budget_categories_household_idx" ON "budget_categories" USING btree ("household_id");--> statement-breakpoint
CREATE UNIQUE INDEX "budget_periods_household_month_category_uq" ON "budget_periods" USING btree ("household_id","month","category_id");--> statement-breakpoint
CREATE INDEX "budget_periods_household_month_idx" ON "budget_periods" USING btree ("household_id","month");--> statement-breakpoint
CREATE INDEX "cashflow_household_occurred_idx" ON "cashflow_transactions" USING btree ("household_id","occurred_on");--> statement-breakpoint
CREATE INDEX "cashflow_household_category_idx" ON "cashflow_transactions" USING btree ("household_id","category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cashflow_household_external_uq" ON "cashflow_transactions" USING btree ("household_id","external_id");--> statement-breakpoint
CREATE INDEX "csv_imports_household_idx" ON "csv_imports" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "financial_accounts_household_idx" ON "financial_accounts" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "financial_accounts_household_type_idx" ON "financial_accounts" USING btree ("household_id","type");--> statement-breakpoint
CREATE INDEX "financial_goals_household_idx" ON "financial_goals" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "financial_goals_household_status_idx" ON "financial_goals" USING btree ("household_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "holding_prices_holding_asof_uq" ON "holding_prices" USING btree ("holding_id","as_of");--> statement-breakpoint
CREATE INDEX "holding_prices_holding_asof_idx" ON "holding_prices" USING btree ("holding_id","as_of");--> statement-breakpoint
CREATE UNIQUE INDEX "holdings_account_symbol_uq" ON "holdings" USING btree ("account_id","symbol");--> statement-breakpoint
CREATE INDEX "holdings_account_idx" ON "holdings" USING btree ("account_id");