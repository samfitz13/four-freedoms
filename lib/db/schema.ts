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
