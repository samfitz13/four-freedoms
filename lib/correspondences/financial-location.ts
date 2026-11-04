import "server-only";
import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  cashflowTransactions,
  financialAccounts,
  monthlyStatements,
  places,
  properties,
  residences,
  trips,
} from "@/lib/db/schema";
import { cashflowByMonth, latestBalances, toNumber } from "@/lib/db/queries/financial";
import type { Correspondence } from "./types";
import { daysAgo, money, pct } from "./common";

export async function financialLocationCorrespondences(
  householdId: string,
  today: Date = new Date(),
): Promise<Correspondence[]> {
  const todayIso = today.toISOString().slice(0, 10);
  const [housing, trip, equity] = await Promise.all([
    housingShare(householdId),
    tripEnvelope(householdId, todayIso),
    propertyEquity(householdId),
  ]);
  return [housing, trip, equity].filter((row): row is Correspondence => row !== null);
}

async function housingShare(householdId: string): Promise<Correspondence | null> {
  const [residence] = await db
    .select({
      costPerMonth: residences.costPerMonth,
      placeName: places.name,
    })
    .from(residences)
    .innerJoin(places, eq(residences.placeId, places.id))
    .where(
      and(
        eq(residences.householdId, householdId),
        eq(residences.role, "primary"),
        isNull(residences.endedOn),
      ),
    )
    .orderBy(desc(residences.startedOn))
    .limit(1);
  const cost = toNumber(residence?.costPerMonth);
  if (cost <= 0) return null;

  const months = await cashflowByMonth(householdId, 3);
  const income = months.filter((month) => month.income > 0).map((month) => month.income);
  const takeHome = income.length
    ? income.reduce((sum, value) => sum + value, 0) / income.length
    : null;
  if (!takeHome || takeHome <= 0) {
    return {
      key: "financial-location-housing-cost",
      pair: ["financial", "location"],
      sentence: `${residence?.placeName ?? "Housing"} costs ${money(cost)} a month; take-home needs more history.`,
      href: "/location/home",
    };
  }
  return {
    key: "financial-location-housing-share",
    pair: ["financial", "location"],
    sentence: `${residence?.placeName ?? "Housing"} is ${pct(cost / takeHome)} of trailing take-home.`,
    href: "/financial/cashflow",
  };
}

async function tripEnvelope(householdId: string, todayIso: string): Promise<Correspondence | null> {
  const [trip] = await db
    .select({
      id: trips.id,
      name: trips.name,
      startsOn: trips.startsOn,
      endsOn: trips.endsOn,
      budgetAmount: trips.budgetAmount,
    })
    .from(trips)
    .where(
      and(
        eq(trips.householdId, householdId),
        isNull(trips.archivedAt),
        or(gte(trips.endsOn, daysAgo(new Date(todayIso), 90)), gte(trips.startsOn, todayIso)),
      ),
    )
    .orderBy(lte(trips.startsOn, todayIso), desc(trips.startsOn))
    .limit(1);
  if (!trip) return null;

  const rows = await db
    .select({ amount: cashflowTransactions.amount })
    .from(cashflowTransactions)
    .where(
      and(
        eq(cashflowTransactions.householdId, householdId),
        eq(cashflowTransactions.tripId, trip.id),
      ),
    );
  const spent = rows.reduce((sum, row) => sum + Math.abs(Math.min(0, toNumber(row.amount))), 0);
  const budget = toNumber(trip.budgetAmount);
  if (budget > 0) {
    return {
      key: `financial-location-trip-${trip.id}`,
      pair: ["financial", "location"],
      sentence: `${trip.name} is ${money(spent)} spent against ${money(budget)} planned.`,
      href: "/location/travel",
    };
  }
  if (spent <= 0) return null;
  return {
    key: `financial-location-trip-${trip.id}`,
    pair: ["financial", "location"],
    sentence: `${trip.name} has ${money(spent)} tagged travel spend.`,
    href: "/financial/cashflow",
  };
}

async function propertyEquity(householdId: string): Promise<Correspondence | null> {
  const [property] = await db
    .select({
      id: properties.id,
      placeName: places.name,
      assetAccountId: properties.accountId,
      mortgageAccountId: properties.mortgageAccountId,
    })
    .from(properties)
    .innerJoin(places, eq(properties.placeId, places.id))
    .where(and(eq(properties.householdId, householdId), isNull(properties.disposedOn)))
    .limit(1);
  if (!property) return null;

  const balances = await latestBalances(householdId);
  const value = balances.find((row) => row.accountId === property.assetAccountId)?.balance ?? 0;
  const debt =
    property.mortgageAccountId === null
      ? 0
      : Math.abs(
          balances.find((row) => row.accountId === property.mortgageAccountId)?.balance ?? 0,
        );
  if (value === 0 && debt === 0) return null;

  const statementRows = await db
    .select({ month: monthlyStatements.month })
    .from(monthlyStatements)
    .innerJoin(financialAccounts, eq(monthlyStatements.accountId, financialAccounts.id))
    .where(eq(financialAccounts.id, property.assetAccountId))
    .orderBy(desc(monthlyStatements.month))
    .limit(1);

  return {
    key: `financial-location-property-${property.id}`,
    pair: ["financial", "location"],
    sentence: `${property.placeName} equity reads as ${money(value - debt)}${statementRows[0] ? ` as of ${statementRows[0].month.slice(0, 7)}` : ""}.`,
    href: "/location/properties",
  };
}
