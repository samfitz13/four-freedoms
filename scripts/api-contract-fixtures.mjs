import { redirect } from "./route-fixture-adapters.mjs";
export { redirect, NextResponse } from "./route-fixture-adapters.mjs";

class ContractState {
  authenticated = true;
  configured = true;
  returnPath = "/time/agenda";
  accounts = [];
  exchanges = [];
  syncs = [];
}
export const state = new ContractState();

export async function requireSession(nextPath = "/") {
  if (!state.authenticated) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return { session: { id: "synthetic-session" }, user: { id: "synthetic-user" } };
}
export async function requireUser() {
  return (await requireSession()).user;
}
export async function getPrimaryHouseholdId() {
  return "synthetic-household";
}
export async function consumeCalendarOAuthState() {
  return state.returnPath;
}
export function googleCalendarConfigured() {
  return state.configured;
}
export async function exchangeGoogleCalendarCode(householdId, code) {
  state.exchanges.push({ householdId, code });
}
export async function syncGoogleCalendarAccount(id) {
  state.syncs.push(id);
}
export function eq(column, value) {
  return (account) => account[column] === value;
}
export function desc(column) {
  return (left, right) => {
    const a = left[column];
    const b = right[column];
    return a < b ? 1 : a > b ? -1 : 0;
  };
}
export const calendarAccounts = Object.freeze({
  id: "id",
  householdId: "householdId",
  createdAt: "createdAt",
});

class ContractDatabase {
  select(selection) {
    let condition = () => true;
    let limit = Infinity;
    let ordering = () => 0;
    return {
      from() {
        return this;
      },
      where(predicate) {
        condition = predicate;
        return this;
      },
      orderBy(comparator) {
        ordering = comparator;
        return this;
      },
      limit(value) {
        limit = value;
        return this;
      },
      then(resolve, reject) {
        return Promise.resolve(
          state.accounts
            .filter(condition)
            .sort(ordering)
            .slice(0, limit)
            .map((account) =>
              selection
                ? Object.fromEntries(
                    Object.entries(selection).map(([key, column]) => [key, account[column]]),
                  )
                : account,
            ),
        ).then(resolve, reject);
      },
    };
  }
}
export const db = new ContractDatabase();
