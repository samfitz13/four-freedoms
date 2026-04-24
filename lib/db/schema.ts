/**
 * Drizzle schema. One file for now; split by concern once it grows.
 *
 * Conventions:
 *   - snake_case column names, camelCase TS fields (drizzle maps for us).
 *   - `id` is `text` (better-auth uses string ids; cheap + portable).
 *   - Every tenant-scoped table has `household_id` + a `(household_id, ...)` index.
 *   - Per-freedom shape stays loose in `payload jsonb` until we graduate to
 *     typed per-freedom tables (PR 5+).
 */
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  date,
  numeric,
  primaryKey,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// auth (better-auth)
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  name: text("name"),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
      mode: "date",
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
      mode: "date",
    }),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("accounts_user_id_idx").on(t.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

// ---------------------------------------------------------------------------
// app: households + memberships
// ---------------------------------------------------------------------------
export const householdRole = pgEnum("household_role", ["owner", "member"]);

export const households = pgTable("households", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default("Personal"),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: householdRole("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.householdId, t.userId] }),
    index("memberships_user_id_idx").on(t.userId),
  ],
);

// ---------------------------------------------------------------------------
// app: the four freedoms
// ---------------------------------------------------------------------------
export const freedom = pgEnum("freedom", ["financial", "location", "time", "health"]);

export const entrySource = pgEnum("entry_source", [
  "manual",
  "plaid",
  "apple_health",
  "google_calendar",
  "import",
]);

export const goalPeriod = pgEnum("goal_period", ["weekly", "monthly", "quarterly", "yearly"]);

export const goalStatus = pgEnum("goal_status", ["active", "achieved", "archived"]);

/**
 * Per-household, per-freedom configuration.
 * `targetJson` holds freedom-specific baseline targets (e.g. savings_rate: 0.3).
 */
export const freedomSettings = pgTable(
  "freedom_settings",
  {
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    freedom: freedom("freedom").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    targetJson: jsonb("target_json").$type<Record<string, unknown>>(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.householdId, t.freedom] })],
);

/**
 * Freedom log. One row per check-in per freedom per day.
 * Unique per (household, freedom, occurred_on) so the daily check-in upserts.
 */
export const entries = pgTable(
  "entries",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    freedom: freedom("freedom").notNull(),
    occurredOn: date("occurred_on").notNull(), // ISO date string (YYYY-MM-DD)
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    source: entrySource("source").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("entries_household_freedom_day_uq").on(t.householdId, t.freedom, t.occurredOn),
    index("entries_household_occurred_idx").on(t.householdId, t.occurredOn),
    index("entries_household_freedom_idx").on(t.householdId, t.freedom),
  ],
);

export const goals = pgTable(
  "goals",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    freedom: freedom("freedom").notNull(),
    title: text("title").notNull(),
    targetJson: jsonb("target_json").$type<Record<string, unknown>>(),
    period: goalPeriod("period").notNull().default("weekly"),
    status: goalStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("goals_household_freedom_idx").on(t.householdId, t.freedom),
    index("goals_household_status_idx").on(t.householdId, t.status),
  ],
);

/**
 * Weekly review: one row per (household, week_start). `reflectionsJson` holds
 * per-freedom wins / friction / next-intention text; `overallScore` is optional.
 */
export const weeklyReviews = pgTable(
  "weekly_reviews",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(), // ISO Monday
    reflectionsJson: jsonb("reflections_json").$type<Record<string, unknown>>().notNull(),
    overallScore: integer("overall_score"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("weekly_reviews_household_week_uq").on(t.householdId, t.weekStart)],
);

// ---------------------------------------------------------------------------
// app: financial workspace
// ---------------------------------------------------------------------------
export const accountType = pgEnum("account_type", [
  "checking",
  "savings",
  "brokerage",
  "retirement",
  "crypto",
  "real_estate",
  "loan",
  "credit_card",
  "other",
]);

export const holdingAssetClass = pgEnum("holding_asset_class", [
  "cash",
  "equity",
  "fixed_income",
  "crypto",
  "real_estate",
  "alt",
  "other",
]);

export const budgetCategoryKind = pgEnum("budget_category_kind", [
  "income",
  "fixed",
  "variable",
  "savings",
  "debt",
]);

export const financialGoalKind = pgEnum("financial_goal_kind", [
  "fi_number",
  "net_worth_target",
  "savings_milestone",
  "debt_payoff",
  "emergency_fund",
]);

export const csvImportKind = pgEnum("csv_import_kind", ["accounts", "transactions", "holdings"]);

export const csvImportStatus = pgEnum("csv_import_status", [
  "pending",
  "succeeded",
  "failed",
  "partial",
]);

/**
 * Household-owned financial accounts. `isManual=true` when the user is
 * maintaining balances by hand; provider-linked accounts carry `externalId`
 * and (for Plaid) `plaidItemId`.
 */
export const financialAccounts = pgTable(
  "financial_accounts",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: accountType("type").notNull(),
    subtype: text("subtype"),
    currency: text("currency").notNull().default("USD"),
    institution: text("institution"),
    isManual: boolean("is_manual").notNull().default(true),
    isArchived: boolean("is_archived").notNull().default(false),
    externalId: text("external_id"),
    plaidItemId: text("plaid_item_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("financial_accounts_household_idx").on(t.householdId),
    index("financial_accounts_household_type_idx").on(t.householdId, t.type),
  ],
);

/**
 * Point-in-time balance per account. Unique on `(accountId, asOf)` so imports
 * and manual snapshots upsert cleanly.
 */
export const accountBalances = pgTable(
  "account_balances",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => financialAccounts.id, { onDelete: "cascade" }),
    asOf: date("as_of").notNull(),
    balance: numeric("balance", { precision: 18, scale: 2 }).notNull(),
    source: entrySource("source").notNull().default("manual"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("account_balances_account_asof_uq").on(t.accountId, t.asOf),
    index("account_balances_account_asof_idx").on(t.accountId, t.asOf),
  ],
);

/**
 * Holdings within a brokerage/retirement/crypto account. One row per symbol.
 */
export const holdings = pgTable(
  "holdings",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => financialAccounts.id, { onDelete: "cascade" }),
    symbol: text("symbol").notNull(),
    name: text("name"),
    assetClass: holdingAssetClass("asset_class").notNull().default("equity"),
    quantity: numeric("quantity", { precision: 24, scale: 8 }).notNull(),
    costBasis: numeric("cost_basis", { precision: 18, scale: 2 }),
    currency: text("currency").notNull().default("USD"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("holdings_account_symbol_uq").on(t.accountId, t.symbol),
    index("holdings_account_idx").on(t.accountId),
  ],
);

/** Historical prices per holding for valuation. */
export const holdingPrices = pgTable(
  "holding_prices",
  {
    id: text("id").primaryKey(),
    holdingId: text("holding_id")
      .notNull()
      .references(() => holdings.id, { onDelete: "cascade" }),
    asOf: date("as_of").notNull(),
    price: numeric("price", { precision: 18, scale: 6 }).notNull(),
    source: entrySource("source").notNull().default("manual"),
  },
  (t) => [
    uniqueIndex("holding_prices_holding_asof_uq").on(t.holdingId, t.asOf),
    index("holding_prices_holding_asof_idx").on(t.holdingId, t.asOf),
  ],
);

/**
 * Cashflow transactions (income positive, expense negative). Optional
 * `accountId` so aggregate/manual rows can be recorded without a specific
 * account context.
 */
export const cashflowTransactions = pgTable(
  "cashflow_transactions",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    accountId: text("account_id").references(() => financialAccounts.id, {
      onDelete: "set null",
    }),
    occurredOn: date("occurred_on").notNull(),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("USD"),
    description: text("description"),
    categoryId: text("category_id"),
    source: entrySource("source").notNull().default("manual"),
    externalId: text("external_id"),
    importBatchId: text("import_batch_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("cashflow_household_occurred_idx").on(t.householdId, t.occurredOn),
    index("cashflow_household_category_idx").on(t.householdId, t.categoryId),
    uniqueIndex("cashflow_household_external_uq").on(t.householdId, t.externalId),
  ],
);

export const budgetCategories = pgTable(
  "budget_categories",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: budgetCategoryKind("kind").notNull().default("variable"),
    colorVar: text("color_var"),
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("budget_categories_household_name_uq").on(t.householdId, t.name),
    index("budget_categories_household_idx").on(t.householdId),
  ],
);

/**
 * Planned spend per category per month. `month` is the 1st of the month.
 */
export const budgetPeriods = pgTable(
  "budget_periods",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => budgetCategories.id, { onDelete: "cascade" }),
    month: date("month").notNull(),
    plannedAmount: numeric("planned_amount", { precision: 18, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("budget_periods_household_month_category_uq").on(
      t.householdId,
      t.month,
      t.categoryId,
    ),
    index("budget_periods_household_month_idx").on(t.householdId, t.month),
  ],
);

export const financialGoals = pgTable(
  "financial_goals",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    kind: financialGoalKind("kind").notNull(),
    title: text("title").notNull(),
    targetAmount: numeric("target_amount", { precision: 18, scale: 2 }),
    targetDate: date("target_date"),
    params: jsonb("params").$type<Record<string, unknown>>(),
    status: goalStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("financial_goals_household_idx").on(t.householdId),
    index("financial_goals_household_status_idx").on(t.householdId, t.status),
  ],
);

export const csvImports = pgTable(
  "csv_imports",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: csvImportKind("kind").notNull(),
    filename: text("filename").notNull(),
    rowCount: integer("row_count").notNull().default(0),
    status: csvImportStatus("status").notNull().default("pending"),
    errorJson: jsonb("error_json").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("csv_imports_household_idx").on(t.householdId)],
);

// ---------------------------------------------------------------------------
// inferred types (use these in app code)
// ---------------------------------------------------------------------------
export type User = typeof users.$inferSelect;
export type Household = typeof households.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type FreedomSettings = typeof freedomSettings.$inferSelect;
export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;
export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
export type WeeklyReview = typeof weeklyReviews.$inferSelect;
export type NewWeeklyReview = typeof weeklyReviews.$inferInsert;

export type FinancialAccount = typeof financialAccounts.$inferSelect;
export type NewFinancialAccount = typeof financialAccounts.$inferInsert;
export type AccountBalance = typeof accountBalances.$inferSelect;
export type NewAccountBalance = typeof accountBalances.$inferInsert;
export type Holding = typeof holdings.$inferSelect;
export type NewHolding = typeof holdings.$inferInsert;
export type HoldingPrice = typeof holdingPrices.$inferSelect;
export type NewHoldingPrice = typeof holdingPrices.$inferInsert;
export type CashflowTransaction = typeof cashflowTransactions.$inferSelect;
export type NewCashflowTransaction = typeof cashflowTransactions.$inferInsert;
export type BudgetCategory = typeof budgetCategories.$inferSelect;
export type NewBudgetCategory = typeof budgetCategories.$inferInsert;
export type BudgetPeriod = typeof budgetPeriods.$inferSelect;
export type NewBudgetPeriod = typeof budgetPeriods.$inferInsert;
export type FinancialGoal = typeof financialGoals.$inferSelect;
export type NewFinancialGoal = typeof financialGoals.$inferInsert;
export type CsvImport = typeof csvImports.$inferSelect;
export type NewCsvImport = typeof csvImports.$inferInsert;
