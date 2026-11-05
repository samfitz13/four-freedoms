CREATE TABLE "account_reconciliations" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"as_of" date NOT NULL,
	"bank_balance" numeric(18, 2) NOT NULL,
	"computed_balance" numeric(18, 2) NOT NULL,
	"delta" numeric(18, 2) NOT NULL,
	"source" text NOT NULL,
	"source_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_reconciliations" ADD CONSTRAINT "account_reconciliations_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recon_account_asof_uq" ON "account_reconciliations" USING btree ("account_id","as_of");--> statement-breakpoint
CREATE INDEX "recon_account_idx" ON "account_reconciliations" USING btree ("account_id");