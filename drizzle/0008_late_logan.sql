CREATE TABLE "monthly_statements" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"account_id" text NOT NULL,
	"month" date NOT NULL,
	"ending_balance" numeric(18, 2) NOT NULL,
	"employee_contribution" numeric(18, 2) DEFAULT '0' NOT NULL,
	"employer_match" numeric(18, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_summaries" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"month" date NOT NULL,
	"savings_rate_goal" numeric(5, 4),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paystubs" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"pay_date" date NOT NULL,
	"period_start" date,
	"period_end" date,
	"employer" text,
	"gross" numeric(18, 2) DEFAULT '0' NOT NULL,
	"taxes" numeric(18, 2) DEFAULT '0' NOT NULL,
	"employee_401k" numeric(18, 2) DEFAULT '0' NOT NULL,
	"employee_roth_401k" numeric(18, 2) DEFAULT '0' NOT NULL,
	"employer_match" numeric(18, 2) DEFAULT '0' NOT NULL,
	"hsa" numeric(18, 2) DEFAULT '0' NOT NULL,
	"other_pretax" numeric(18, 2) DEFAULT '0' NOT NULL,
	"other_posttax" numeric(18, 2) DEFAULT '0' NOT NULL,
	"net" numeric(18, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cashflow_transactions" ADD COLUMN "contribution_to_account_id" text;--> statement-breakpoint
ALTER TABLE "monthly_statements" ADD CONSTRAINT "monthly_statements_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_statements" ADD CONSTRAINT "monthly_statements_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_summaries" ADD CONSTRAINT "monthly_summaries_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paystubs" ADD CONSTRAINT "paystubs_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_statements_account_month_uq" ON "monthly_statements" USING btree ("account_id","month");--> statement-breakpoint
CREATE INDEX "monthly_statements_household_month_idx" ON "monthly_statements" USING btree ("household_id","month");--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_summaries_household_month_uq" ON "monthly_summaries" USING btree ("household_id","month");--> statement-breakpoint
CREATE INDEX "monthly_summaries_household_idx" ON "monthly_summaries" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "paystubs_household_paydate_idx" ON "paystubs" USING btree ("household_id","pay_date");--> statement-breakpoint
ALTER TABLE "cashflow_transactions" ADD CONSTRAINT "cashflow_transactions_contribution_to_account_id_financial_accounts_id_fk" FOREIGN KEY ("contribution_to_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cashflow_contribution_account_idx" ON "cashflow_transactions" USING btree ("contribution_to_account_id");