// Disconnected query adapters for the security regression suite.
export { redirect, NextResponse } from "./route-fixture-adapters.mjs";

class FixtureState {
  tables = {};
  writes = [];
  exchanges = [];
  transactions = 0;
  authenticated = true;
}
class FixtureEnvironment {
  NODE_ENV = "development";
  EMAIL_FROM = "test@example.invalid";
  GOOGLE_CLIENT_ID = "synthetic-client";
  GOOGLE_CLIENT_SECRET = "synthetic-client-secret";
  GOOGLE_REDIRECT_URI = "https://app.example/api/time/calendar/callback";
}
export const state = new FixtureState();
export const env = new FixtureEnvironment();

function table(name) {
  return new Proxy(
    { __table: name },
    { get: (target, key) => (key === "__table" ? target.__table : { table: name, column: key }) },
  );
}

export const places = table("places");
export const stays = table("stays");
export const connections = table("connections");
export const connectionVisits = table("connectionVisits");
export const locationSatisfactions = table("locationSatisfactions");
export const habits = table("habits");
export const habitCheckins = table("habitCheckins");
export const timePursuits = table("timePursuits");
export const timeLogEntries = table("timeLogEntries");
export const timeBlocks = table("timeBlocks");
export const timeEvents = table("timeEvents");
export const calendarAccounts = table("calendarAccounts");
export const verifications = table("verifications");
export const residences = table("residences");
export const properties = table("properties");
export const financialAccounts = table("financialAccounts");
export const monthlyStatements = table("monthlyStatements");
export const trips = table("trips");
export const budgetCategories = table("budgetCategories");
export const budgetPeriods = table("budgetPeriods");
export const syncEvents = table("syncEvents");

function value(input, row) {
  return input?.column ? row[input.table]?.[input.column] : input;
}

export function eq(left, right) {
  return (row) => value(left, row) === value(right, row);
}
export function and(...conditions) {
  return (row) => conditions.every((condition) => !condition || condition(row));
}
export function inArray(column, values) {
  return (row) => values.includes(value(column, row));
}
export function isNull(column) {
  return (row) => value(column, row) == null;
}
export function gte(left, right) {
  return (row) => value(left, row) >= value(right, row);
}
export function lte(left, right) {
  return (row) => value(left, row) <= value(right, row);
}
export function asc(column) {
  return column;
}
export function desc(column) {
  return column;
}
export function sql(_strings, column) {
  return isNull(column);
}

function rows(table) {
  return (state.tables[table.__table] ??= []);
}
function project(selection, row, table) {
  return selection
    ? Object.fromEntries(
        Object.entries(selection).map(([key, column]) => [key, value(column, row) ?? null]),
      )
    : row[table.__table];
}
function query(selection) {
  let source;
  let condition = () => true;
  let count = Infinity;
  const joins = [];
  return {
    from(table) {
      source = table;
      return this;
    },
    where(predicate) {
      condition = predicate;
      return this;
    },
    innerJoin(table, predicate) {
      joins.push({ table, predicate, inner: true });
      return this;
    },
    leftJoin(table, predicate) {
      joins.push({ table, predicate, inner: false });
      return this;
    },
    orderBy() {
      return this;
    },
    limit(limit) {
      count = limit;
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve()
        .then(() => {
          let result = rows(source).map((record) => ({ [source.__table]: record }));
          for (const join of joins) {
            result = result.flatMap((row) => {
              const matches = rows(join.table)
                .map((record) => ({ ...row, [join.table.__table]: record }))
                .filter(join.predicate);
              return matches.length || join.inner
                ? matches
                : [{ ...row, [join.table.__table]: null }];
            });
          }
          return result
            .filter(condition)
            .slice(0, count)
            .map((row) => project(selection, row, source));
        })
        .then(resolve, reject);
    },
  };
}

class FixtureDatabase {
  select = query;
  insert(table) {
    return {
      values(record) {
        const write = {
          onConflictDoNothing() {
            return this;
          },
          onConflictDoUpdate() {
            return this;
          },
          then(resolve, reject) {
            return Promise.resolve()
              .then(() => {
                rows(table).push(record);
                state.writes.push({ operation: "insert", table: table.__table, record });
              })
              .then(resolve, reject);
          },
        };
        return write;
      },
    };
  }
  update(table) {
    return {
      set(values) {
        return {
          async where(condition) {
            for (const record of rows(table)) {
              if (condition({ [table.__table]: record })) Object.assign(record, values);
            }
            state.writes.push({ operation: "update", table: table.__table, values });
          },
        };
      },
    };
  }
  delete(table) {
    return {
      where(condition) {
        return {
          async returning(selection) {
            const deleted = rows(table).filter((record) => condition({ [table.__table]: record }));
            state.tables[table.__table] = rows(table).filter((record) => !deleted.includes(record));
            return deleted.map((record) => project(selection, { [table.__table]: record }, table));
          },
        };
      },
    };
  }
  async transaction(callback) {
    state.transactions += 1;
    return callback(db);
  }
}
export const db = new FixtureDatabase();

export async function requireSession() {
  if (!state.authenticated) throw new Error("Unauthenticated");
  return { session: { id: "test-session" }, user: { id: "test-user" } };
}
export async function requireUser() {
  return (await requireSession()).user;
}
export async function getPrimaryHouseholdId() {
  return "household";
}
export async function scopeForUser() {
  return { primaryHouseholdId: "household" };
}
export function revalidatePath() {}
export async function ensureTimeSeeded() {}
export async function derivedHabitHit() {
  return false;
}
export function toNumber(input) {
  return Number(input ?? 0);
}
export async function exchangeGoogleCalendarCode(householdId, code) {
  state.exchanges.push({ householdId, code });
}
export async function syncGoogleCalendarAccount() {}
export class Resend {
  emails = { send: async () => ({ data: { id: "sent" } }) };
}

export { buildGoogleCalendarAuthUrl, googleCalendarConfigured } from "../lib/calendar/google";
