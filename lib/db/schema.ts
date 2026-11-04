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
  time,
  numeric,
  primaryKey,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
import type { InvestmentSnapshotData } from "@/lib/financial/portfolio/types";

// ---------------------------------------------------------------------------
// auth (better-auth)
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  name: text("name"),
  image: text("image"),
  birthDate: date("birth_date", { mode: "string" }),
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
  "plaid", // Retained for historical records; the integration has been removed.
  "apple_health",
  "google_calendar",
  "import",
]);

export const goalStatus = pgEnum("goal_status", ["active", "achieved", "archived"]);

export const workoutKind = pgEnum("workout_kind", [
  "strength",
  "cardio",
  "mobility",
  "sport",
  "other",
]);

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
  "equity_comp",
  "iso_options",
  "other",
]);

export const employerRelationship = pgEnum("employer_relationship", ["current", "former"]);

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
  "savings_rate_target",
]);

export const csvImportKind = pgEnum("csv_import_kind", ["accounts", "transactions", "holdings"]);

export const transactionKind = pgEnum("transaction_kind", ["cashflow", "transfer"]);

export const syncEventKind = pgEnum("sync_event_kind", [
  "trip_time_event",
  "connection_visit_time_event",
  "residence_housing_budget",
  "property_account_valuation",
  "paystub_iso_employer",
]);

export const paystubKind = pgEnum("paystub_kind", [
  "regular",
  "bonus",
  "rsu",
  "correction",
  "final",
]);

export const csvImportStatus = pgEnum("csv_import_status", [
  "pending",
  "succeeded",
  "failed",
  "partial",
]);

/**
 * Household-owned financial accounts. `isManual=true` when the user is
 * maintaining balances by hand.
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
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("financial_accounts_household_idx").on(t.householdId),
    index("financial_accounts_household_type_idx").on(t.householdId, t.type),
  ],
);

/** Imported holdings are evidence snapshots, never month-end ledger entries. */
export const investmentSnapshots = pgTable(
  "investment_snapshots",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => financialAccounts.id, { onDelete: "cascade" }),
    preparedOn: date("prepared_on").notNull(),
    sourceKey: text("source_key").notNull(),
    data: jsonb("data").$type<InvestmentSnapshotData>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("investment_snapshots_account_source_uq").on(t.accountId, t.sourceKey),
    index("investment_snapshots_household_account_idx").on(t.householdId, t.accountId),
  ],
);

export const isoOptionGrants = pgTable(
  "iso_option_grants",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => financialAccounts.id, { onDelete: "cascade" }),
    employerName: text("employer_name").notNull(),
    employerRelationship: employerRelationship("employer_relationship").notNull(),
    employmentEndDate: date("employment_end_date"),
    postTerminationExerciseDays: integer("post_termination_exercise_days").notNull().default(90),
    label: text("label").notNull(),
    grantDate: date("grant_date"),
    vestingStartDate: date("vesting_start_date"),
    vestingSchedule: jsonb("vesting_schedule")
      .$type<{
        type: "monthly" | "quarterly" | "annual";
        durationMonths: number;
        cliffMonths: number;
      }>()
      .notNull()
      .default({ type: "monthly", durationMonths: 48, cliffMonths: 12 }),
    earlyExerciseAllowed: boolean("early_exercise_allowed").notNull().default(false),
    expirationDate: date("expiration_date"),
    totalShares: integer("total_shares").notNull(),
    strikePrice: numeric("strike_price", { precision: 18, scale: 6 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("iso_option_grants_household_idx").on(t.householdId),
    index("iso_option_grants_account_idx").on(t.accountId),
  ],
);

export const isoOptionAccountDetails = pgTable(
  "iso_option_account_details",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => financialAccounts.id, { onDelete: "cascade" }),
    employerName: text("employer_name").notNull(),
    employerRelationship: employerRelationship("employer_relationship")
      .notNull()
      .default("current"),
    employmentEndDate: date("employment_end_date"),
    postTerminationExerciseDays: integer("post_termination_exercise_days").notNull().default(90),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("iso_option_account_details_account_uq").on(t.accountId),
    index("iso_option_account_details_household_idx").on(t.householdId),
  ],
);

export const isoOptionValuations = pgTable(
  "iso_option_valuations",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => financialAccounts.id, { onDelete: "cascade" }),
    asOf: date("as_of").notNull(),
    fmv: numeric("fmv", { precision: 18, scale: 6 }).notNull(),
    sharePrice: numeric("share_price", { precision: 18, scale: 6 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("iso_option_valuations_household_idx").on(t.householdId),
    index("iso_option_valuations_account_as_of_idx").on(t.accountId, t.asOf),
  ],
);

export const isoOptionExercises = pgTable(
  "iso_option_exercises",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    grantId: text("grant_id")
      .notNull()
      .references(() => isoOptionGrants.id, { onDelete: "cascade" }),
    exerciseDate: date("exercise_date").notNull(),
    shares: integer("shares").notNull(),
    exercisePrice: numeric("exercise_price", { precision: 18, scale: 6 }),
    fmvAtExercise: numeric("fmv_at_exercise", { precision: 18, scale: 6 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("iso_option_exercises_household_idx").on(t.householdId),
    index("iso_option_exercises_grant_date_idx").on(t.grantId, t.exerciseDate),
  ],
);

export const isoOptionVestingEvents = pgTable(
  "iso_option_vesting_events",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    grantId: text("grant_id")
      .notNull()
      .references(() => isoOptionGrants.id, { onDelete: "cascade" }),
    vestDate: date("vest_date").notNull(),
    shares: integer("shares").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("iso_option_vesting_events_household_idx").on(t.householdId),
    index("iso_option_vesting_events_grant_date_idx").on(t.grantId, t.vestDate),
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
    kind: transactionKind("kind").notNull().default("cashflow"),
    transferGroupId: text("transfer_group_id"),
    transferPeerId: text("transfer_peer_id"),
    contributionToAccountId: text("contribution_to_account_id").references(
      () => financialAccounts.id,
      { onDelete: "set null" },
    ),
    tripId: text("trip_id").references(() => trips.id, { onDelete: "set null" }),
    residenceId: text("residence_id").references(() => residences.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("cashflow_household_occurred_idx").on(t.householdId, t.occurredOn),
    index("cashflow_household_category_idx").on(t.householdId, t.categoryId),
    index("cashflow_household_kind_idx").on(t.householdId, t.kind),
    index("cashflow_household_trip_idx").on(t.householdId, t.tripId),
    index("cashflow_household_residence_idx").on(t.householdId, t.residenceId),
    index("cashflow_transfer_group_idx").on(t.transferGroupId),
    index("cashflow_contribution_account_idx").on(t.contributionToAccountId),
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

/**
 * Per-account, per-month statement. The unit of the wealth ledger: an
 * end-of-month balance plus the contributions that landed during the month.
 * `month` is always the first day of the month (YYYY-MM-01); the balance is
 * implicitly end-of-month.
 *
 * `employeeContribution` doubles as `principal_paid` for debt accounts —
 * the UI relabels the column based on `account_type`.
 */
export const monthlyStatements = pgTable(
  "monthly_statements",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => financialAccounts.id, { onDelete: "cascade" }),
    month: date("month").notNull(),
    endingBalance: numeric("ending_balance", { precision: 18, scale: 2 }).notNull(),
    employeeContribution: numeric("employee_contribution", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    employerMatch: numeric("employer_match", { precision: 18, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("monthly_statements_account_month_uq").on(t.accountId, t.month),
    index("monthly_statements_household_month_idx").on(t.householdId, t.month),
  ],
);

/**
 * Per-household, per-month free-form summary fields. Today this is just
 * `savingsRateGoal` (0..1) because it varies month to month in practice;
 * future fields like a manual "net income override" can land here.
 */
export const monthlySummaries = pgTable(
  "monthly_summaries",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    month: date("month").notNull(),
    savingsRateGoal: numeric("savings_rate_goal", { precision: 5, scale: 4 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("monthly_summaries_household_month_uq").on(t.householdId, t.month),
    index("monthly_summaries_household_idx").on(t.householdId),
  ],
);

/**
 * Paystub source-of-truth for income + retirement contributions. One row
 * per paycheck. `payDate` drives which month the income lands in. Tax /
 * deduction breakdown is loose enough to recreate the spreadsheet's columns
 * without locking us into a schema we'll regret.
 */
export const paystubs = pgTable(
  "paystubs",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    payDate: date("pay_date").notNull(),
    periodStart: date("period_start"),
    periodEnd: date("period_end"),
    kind: paystubKind("kind").notNull().default("regular"),
    employer: text("employer"),
    gross: numeric("gross", { precision: 18, scale: 2 }).notNull().default("0"),
    taxes: numeric("taxes", { precision: 18, scale: 2 }).notNull().default("0"),
    federalIncomeTax: numeric("federal_income_tax", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    socialSecurity: numeric("social_security", { precision: 18, scale: 2 }).notNull().default("0"),
    medicare: numeric("medicare", { precision: 18, scale: 2 }).notNull().default("0"),
    additionalMedicare: numeric("additional_medicare", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    employee401k: numeric("employee_401k", { precision: 18, scale: 2 }).notNull().default("0"),
    employeeRoth401k: numeric("employee_roth_401k", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    employerMatch: numeric("employer_match", { precision: 18, scale: 2 }).notNull().default("0"),
    hsa: numeric("hsa", { precision: 18, scale: 2 }).notNull().default("0"),
    otherPretax: numeric("other_pretax", { precision: 18, scale: 2 }).notNull().default("0"),
    otherPosttax: numeric("other_posttax", { precision: 18, scale: 2 }).notNull().default("0"),
    benefits: numeric("benefits", { precision: 18, scale: 2 }).notNull().default("0"),
    otherIncome: numeric("other_income", { precision: 18, scale: 2 }).notNull().default("0"),
    stateTaxes: jsonb("state_taxes")
      .$type<
        Array<{
          state: string;
          income: number;
          disability?: number;
          fli?: number;
          local?: Array<{ jurisdiction: string; amount: number }>;
        }>
      >()
      .notNull()
      .default([]),
    net: numeric("net", { precision: 18, scale: 2 }).notNull().default("0"),
    netOverridden: boolean("net_overridden").notNull().default(false),
    workPursuitId: text("work_pursuit_id").references(() => timePursuits.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("paystubs_household_paydate_idx").on(t.householdId, t.payDate),
    index("paystubs_household_work_pursuit_idx").on(t.householdId, t.workPursuitId),
  ],
);
// ---------------------------------------------------------------------------
// app: location freedom
// ---------------------------------------------------------------------------

export const residenceRole = pgEnum("residence_role", ["primary", "secondary", "former"]);

export const residenceTenure = pgEnum("residence_tenure", ["rent", "own", "other"]);

export const propertyUse = pgEnum("property_use", [
  "owner_occupied",
  "second_home",
  "rental",
  "investment",
  "other",
]);

export const tripPurpose = pgEnum("trip_purpose", [
  "vacation",
  "family",
  "work",
  "medical",
  "retreat",
  "other",
]);

export const connectionKind = pgEnum("connection_kind", [
  "family",
  "friend",
  "partner",
  "community",
  "neighbor",
  "mentor",
  "other",
]);

export const connectionCadence = pgEnum("connection_cadence", [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "yearly",
]);

export const stayKind = pgEnum("stay_kind", ["residence", "trip", "visit", "other"]);

/** A named place. Same name may appear for multiple countries so we unique on (household, name, country). */
export const places = pgTable(
  "places",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    country: text("country"),
    lat: numeric("lat", { precision: 9, scale: 6 }),
    lng: numeric("lng", { precision: 9, scale: 6 }),
    isPreferred: boolean("is_preferred").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("places_household_name_country_uq").on(t.householdId, t.name, t.country),
    index("places_household_idx").on(t.householdId),
  ],
);

export const trips = pgTable(
  "trips",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    purpose: tripPurpose("purpose").notNull(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    budgetAmount: numeric("budget_amount", { precision: 18, scale: 2 }),
    currency: text("currency").notNull().default("USD"),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("trips_household_starts_idx").on(t.householdId, t.startsOn)],
);

/**
 * A continuous stay at a place. `endedOn` null means "currently there".
 * Unique-ish constraint on (household, place, startedOn) so re-imports upsert.
 */
export const stays = pgTable(
  "stays",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    placeId: text("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    kind: stayKind("kind").notNull().default("other"),
    tripId: text("trip_id").references(() => trips.id, { onDelete: "set null" }),
    startedOn: date("started_on").notNull(),
    endedOn: date("ended_on"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("stays_household_place_started_uq").on(t.householdId, t.placeId, t.startedOn),
    index("stays_household_started_idx").on(t.householdId, t.startedOn),
    index("stays_household_trip_idx").on(t.householdId, t.tripId),
  ],
);

export const residences = pgTable(
  "residences",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    placeId: text("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    role: residenceRole("role").notNull(),
    tenure: residenceTenure("tenure").notNull().default("rent"),
    startedOn: date("started_on").notNull(),
    endedOn: date("ended_on"),
    householdSharePct: numeric("household_share_pct", { precision: 5, scale: 2 })
      .notNull()
      .default("100"),
    costPerMonth: numeric("cost_per_month", { precision: 18, scale: 2 }),
    currency: text("currency").notNull().default("USD"),
    landlord: text("landlord"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("residences_household_role_idx").on(t.householdId, t.role),
    index("residences_household_started_idx").on(t.householdId, t.startedOn),
  ],
);

export const properties = pgTable(
  "properties",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    placeId: text("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => financialAccounts.id, { onDelete: "cascade" }),
    mortgageAccountId: text("mortgage_account_id").references(() => financialAccounts.id, {
      onDelete: "set null",
    }),
    use: propertyUse("use").notNull(),
    ownershipPct: numeric("ownership_pct", { precision: 5, scale: 2 }).notNull().default("100"),
    acquiredOn: date("acquired_on").notNull(),
    disposedOn: date("disposed_on"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("properties_household_account_uq").on(t.householdId, t.accountId),
    index("properties_household_mortgage_account_idx").on(t.householdId, t.mortgageAccountId),
    index("properties_household_use_idx").on(t.householdId, t.use),
  ],
);

export const connections = pgTable(
  "connections",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: connectionKind("kind").notNull(),
    placeId: text("place_id").references(() => places.id, { onDelete: "set null" }),
    cadence: connectionCadence("cadence"),
    lastSeenOn: date("last_seen_on"),
    note: text("note"),
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("connections_household_place_idx").on(t.householdId, t.placeId),
    index("connections_household_kind_idx").on(t.householdId, t.kind),
  ],
);

export const connectionVisits = pgTable(
  "connection_visits",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    connectionId: text("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),
    eventId: text("event_id").references(() => timeEvents.id, { onDelete: "set null" }),
    occurredOn: date("occurred_on").notNull(),
    placeId: text("place_id").references(() => places.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("connection_visits_household_occurred_idx").on(t.householdId, t.occurredOn),
    index("connection_visits_household_event_idx").on(t.householdId, t.eventId),
  ],
);

/** Daily satisfaction (1..10) with being where you currently are. */
export const locationSatisfactions = pgTable(
  "location_satisfactions",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    recordedOn: date("recorded_on").notNull(),
    placeId: text("place_id").references(() => places.id, { onDelete: "set null" }),
    satisfaction: integer("satisfaction").notNull(),
    withConnectionIds: text("with_connection_ids").array().notNull().default([]),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("location_satisfactions_household_day_uq").on(t.householdId, t.recordedOn),
    index("location_satisfactions_household_day_idx").on(t.householdId, t.recordedOn),
  ],
);

// ---------------------------------------------------------------------------
// app: time freedom
// ---------------------------------------------------------------------------

export const pursuitKind = pgEnum("pursuit_kind", ["work", "play", "care", "rest", "admin"]);

export const habitCadence = pgEnum("habit_cadence", ["daily", "weekly", "custom"]);

export const habitLinkKind = pgEnum("habit_link_kind", ["none", "workout", "sleep", "body_weight"]);

export const eventSource = pgEnum("event_source", ["native", "google"]);

export const calendarProvider = pgEnum("calendar_provider", ["google"]);

export const eventStatus = pgEnum("event_status", ["confirmed", "tentative", "cancelled"]);

export const eventExceptionAction = pgEnum("event_exception_action", ["moved", "cancelled"]);

/**
 * Per-day time log. Hours are decimal (e.g. 2.5). `prioritySplit` is 0..1 —
 * the share of working time spent on what matters. Unique per day.
 */
export const timeBlocks = pgTable(
  "time_blocks",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    recordedOn: date("recorded_on").notNull(),
    deepWorkHours: numeric("deep_work_hours", { precision: 5, scale: 2 }).notNull().default("0"),
    meetingHours: numeric("meeting_hours", { precision: 5, scale: 2 }).notNull().default("0"),
    obligationHours: numeric("obligation_hours", { precision: 5, scale: 2 }).notNull().default("0"),
    prioritySplit: numeric("priority_split", { precision: 4, scale: 3 }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("time_blocks_household_day_uq").on(t.householdId, t.recordedOn),
    index("time_blocks_household_day_idx").on(t.householdId, t.recordedOn),
  ],
);

export const timePursuits = pgTable(
  "time_pursuits",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: pursuitKind("kind").notNull().default("work"),
    colorVar: text("color_var").notNull().default("var(--color-freedom-time)"),
    matters: boolean("matters").notNull().default(true),
    weeklyTargetHours: numeric("weekly_target_hours", { precision: 5, scale: 2 }),
    systemKey: text("system_key"),
    sortOrder: integer("sort_order").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("time_pursuits_household_name_uq").on(t.householdId, t.name),
    uniqueIndex("time_pursuits_household_system_key_uq").on(t.householdId, t.systemKey),
    index("time_pursuits_household_kind_idx").on(t.householdId, t.kind),
  ],
);

export const timeLogEntries = pgTable(
  "time_log_entries",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    pursuitId: text("pursuit_id")
      .notNull()
      .references(() => timePursuits.id, { onDelete: "cascade" }),
    recordedOn: date("recorded_on").notNull(),
    hours: numeric("hours", { precision: 5, scale: 2 }).notNull(),
    note: text("note"),
    source: entrySource("source").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("time_log_entries_household_pursuit_day_uq").on(
      t.householdId,
      t.pursuitId,
      t.recordedOn,
    ),
    index("time_log_entries_household_day_idx").on(t.householdId, t.recordedOn),
  ],
);

export const habits = pgTable(
  "habits",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    pursuitId: text("pursuit_id").references(() => timePursuits.id, { onDelete: "set null" }),
    cadence: habitCadence("cadence").notNull().default("daily"),
    targetPerWeek: integer("target_per_week").notNull().default(7),
    timeOfDay: text("time_of_day"),
    linkKind: habitLinkKind("link_kind").notNull().default("none"),
    linkParams: jsonb("link_params").$type<Record<string, unknown>>().notNull().default({}),
    startedOn: date("started_on").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("habits_household_idx").on(t.householdId)],
);

export const habitCheckins = pgTable(
  "habit_checkins",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    habitId: text("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    occurredOn: date("occurred_on").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("habit_checkins_household_habit_day_uq").on(t.householdId, t.habitId, t.occurredOn),
    index("habit_checkins_household_day_idx").on(t.householdId, t.occurredOn),
  ],
);

export const calendarAccounts = pgTable(
  "calendar_accounts",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    provider: calendarProvider("provider").notNull().default("google"),
    externalAccountId: text("external_account_id").notNull(),
    displayEmail: text("display_email"),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token").notNull(),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
      mode: "date",
    }),
    syncToken: text("sync_token"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true, mode: "date" }),
    disabledAt: timestamp("disabled_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("calendar_accounts_household_provider_external_uq").on(
      t.householdId,
      t.provider,
      t.externalAccountId,
    ),
    index("calendar_accounts_household_idx").on(t.householdId),
  ],
);

export const timeEvents = pgTable(
  "time_events",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    source: eventSource("source").notNull().default("native"),
    externalId: text("external_id"),
    calendarAccountId: text("calendar_account_id").references(() => calendarAccounts.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    location: text("location"),
    placeId: text("place_id").references(() => places.id, { onDelete: "set null" }),
    connectionIds: text("connection_ids").array().notNull().default([]),
    description: text("description"),
    pursuitId: text("pursuit_id").references(() => timePursuits.id, { onDelete: "set null" }),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }).notNull(),
    allDay: boolean("all_day").notNull().default(false),
    rrule: text("rrule"),
    timezone: text("timezone").notNull().default("UTC"),
    status: eventStatus("status").notNull().default("confirmed"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("time_events_household_source_external_uq").on(
      t.householdId,
      t.source,
      t.externalId,
    ),
    index("time_events_household_starts_idx").on(t.householdId, t.startsAt),
    index("time_events_household_place_idx").on(t.householdId, t.placeId),
  ],
);

export const timeEventExceptions = pgTable(
  "time_event_exceptions",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => timeEvents.id, { onDelete: "cascade" }),
    occurrenceStartsAt: timestamp("occurrence_starts_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    action: eventExceptionAction("action").notNull(),
    newStartsAt: timestamp("new_starts_at", { withTimezone: true, mode: "date" }),
    newEndsAt: timestamp("new_ends_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("time_event_exceptions_event_idx").on(t.eventId)],
);

// ---------------------------------------------------------------------------
// app: health freedom
// ---------------------------------------------------------------------------

export const sleepLogs = pgTable(
  "sleep_logs",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    recordedOn: date("recorded_on").notNull(),
    sleepHours: numeric("sleep_hours", { precision: 4, scale: 2 }).notNull(),
    bedAt: time("bed_at"),
    wakeAt: time("wake_at"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("sleep_logs_household_day_idx").on(t.householdId, t.recordedOn)],
);

export const healthCheckins = pgTable(
  "health_checkins",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" }).notNull(),
    energy: integer("energy"),
    restingHr: integer("resting_hr"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("health_checkins_household_recorded_idx").on(t.householdId, t.recordedAt.desc())],
);

export const workouts = pgTable(
  "workouts",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    performedAt: timestamp("performed_at", { withTimezone: true, mode: "date" }).notNull(),
    kind: workoutKind("kind").notNull().default("other"),
    minutes: integer("minutes").notNull(),
    intensity: integer("intensity"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("workouts_household_performed_idx").on(t.householdId, t.performedAt.desc())],
);

export const bodyMeasurements = pgTable(
  "body_measurements",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" }).notNull(),
    weightKg: numeric("weight_kg", { precision: 5, scale: 2 }),
    bodyFatPct: numeric("body_fat_pct", { precision: 5, scale: 2 }),
    waistCm: numeric("waist_cm", { precision: 5, scale: 2 }),
    restingHr: integer("resting_hr"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("body_measurements_household_recorded_idx").on(t.householdId, t.recordedAt.desc())],
);

// ---------------------------------------------------------------------------
// app: cross-freedom sync journal
// ---------------------------------------------------------------------------

export const syncEvents = pgTable(
  "sync_events",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    kind: syncEventKind("kind").notNull(),
    sourceId: text("source_id").notNull(),
    targetId: text("target_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("sync_events_household_kind_idx").on(t.householdId, t.kind),
    index("sync_events_source_idx").on(t.sourceId),
    index("sync_events_target_idx").on(t.targetId),
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

export type FinancialAccount = typeof financialAccounts.$inferSelect;
export type NewFinancialAccount = typeof financialAccounts.$inferInsert;
export type IsoOptionGrant = typeof isoOptionGrants.$inferSelect;
export type NewIsoOptionGrant = typeof isoOptionGrants.$inferInsert;
export type IsoOptionAccountDetail = typeof isoOptionAccountDetails.$inferSelect;
export type NewIsoOptionAccountDetail = typeof isoOptionAccountDetails.$inferInsert;
export type IsoOptionValuation = typeof isoOptionValuations.$inferSelect;
export type NewIsoOptionValuation = typeof isoOptionValuations.$inferInsert;
export type IsoOptionExercise = typeof isoOptionExercises.$inferSelect;
export type NewIsoOptionExercise = typeof isoOptionExercises.$inferInsert;
export type IsoOptionVestingEvent = typeof isoOptionVestingEvents.$inferSelect;
export type NewIsoOptionVestingEvent = typeof isoOptionVestingEvents.$inferInsert;
export type CashflowTransaction = typeof cashflowTransactions.$inferSelect;
export type NewCashflowTransaction = typeof cashflowTransactions.$inferInsert;
export type BudgetCategory = typeof budgetCategories.$inferSelect;
export type NewBudgetCategory = typeof budgetCategories.$inferInsert;
export type BudgetPeriod = typeof budgetPeriods.$inferSelect;
export type NewBudgetPeriod = typeof budgetPeriods.$inferInsert;
export type FinancialGoal = typeof financialGoals.$inferSelect;
export type NewFinancialGoal = typeof financialGoals.$inferInsert;
export type MonthlyStatement = typeof monthlyStatements.$inferSelect;
export type NewMonthlyStatement = typeof monthlyStatements.$inferInsert;
export type MonthlySummary = typeof monthlySummaries.$inferSelect;
export type NewMonthlySummary = typeof monthlySummaries.$inferInsert;
export type Paystub = typeof paystubs.$inferSelect;
export type NewPaystub = typeof paystubs.$inferInsert;
export type CsvImport = typeof csvImports.$inferSelect;
export type NewCsvImport = typeof csvImports.$inferInsert;

export type Place = typeof places.$inferSelect;
export type NewPlace = typeof places.$inferInsert;
export type Residence = typeof residences.$inferSelect;
export type NewResidence = typeof residences.$inferInsert;
export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
export type Trip = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;
export type Stay = typeof stays.$inferSelect;
export type NewStay = typeof stays.$inferInsert;
export type Connection = typeof connections.$inferSelect;
export type NewConnection = typeof connections.$inferInsert;
export type ConnectionVisit = typeof connectionVisits.$inferSelect;
export type NewConnectionVisit = typeof connectionVisits.$inferInsert;
export type LocationSatisfaction = typeof locationSatisfactions.$inferSelect;
export type NewLocationSatisfaction = typeof locationSatisfactions.$inferInsert;

export type TimeBlock = typeof timeBlocks.$inferSelect;
export type NewTimeBlock = typeof timeBlocks.$inferInsert;
export type TimePursuit = typeof timePursuits.$inferSelect;
export type NewTimePursuit = typeof timePursuits.$inferInsert;
export type TimeLogEntry = typeof timeLogEntries.$inferSelect;
export type NewTimeLogEntry = typeof timeLogEntries.$inferInsert;
export type Habit = typeof habits.$inferSelect;
export type NewHabit = typeof habits.$inferInsert;
export type HabitCheckin = typeof habitCheckins.$inferSelect;
export type NewHabitCheckin = typeof habitCheckins.$inferInsert;
export type TimeEvent = typeof timeEvents.$inferSelect;
export type NewTimeEvent = typeof timeEvents.$inferInsert;
export type TimeEventException = typeof timeEventExceptions.$inferSelect;
export type NewTimeEventException = typeof timeEventExceptions.$inferInsert;
export type CalendarAccount = typeof calendarAccounts.$inferSelect;
export type NewCalendarAccount = typeof calendarAccounts.$inferInsert;

export type SleepLog = typeof sleepLogs.$inferSelect;
export type NewSleepLog = typeof sleepLogs.$inferInsert;
export type HealthCheckin = typeof healthCheckins.$inferSelect;
export type NewHealthCheckin = typeof healthCheckins.$inferInsert;
export type Workout = typeof workouts.$inferSelect;
export type NewWorkout = typeof workouts.$inferInsert;
export type BodyMeasurement = typeof bodyMeasurements.$inferSelect;
export type NewBodyMeasurement = typeof bodyMeasurements.$inferInsert;
export type SyncEvent = typeof syncEvents.$inferSelect;
export type NewSyncEvent = typeof syncEvents.$inferInsert;
