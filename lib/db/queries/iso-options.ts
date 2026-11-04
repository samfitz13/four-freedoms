import "server-only";
import { and, eq, inArray, lte, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  financialAccounts,
  isoOptionAccountDetails,
  isoOptionExercises,
  isoOptionGrants,
  isoOptionValuations,
} from "@/lib/db/schema";
import type {
  IsoOptionAccountSummary,
  IsoOptionMonthlyCompensation,
  IsoOptionYearCompensation,
} from "@/lib/db/queries/types";

export function isIsoOptionAccount(type: string, subtype: string | null | undefined): boolean {
  return type === "iso_options" || (type === "equity_comp" && subtype === "iso");
}

export async function listIsoOptionSummaries(
  householdId: string,
  asOf: string,
): Promise<IsoOptionAccountSummary[]> {
  const accounts = await db
    .select({ id: financialAccounts.id, name: financialAccounts.name })
    .from(financialAccounts)
    .where(
      and(
        eq(financialAccounts.householdId, householdId),
        or(
          eq(financialAccounts.type, "iso_options"),
          and(eq(financialAccounts.type, "equity_comp"), eq(financialAccounts.subtype, "iso")),
        ),
      ),
    );

  if (accounts.length === 0) return [];
  const accountIds = accounts.map((account) => account.id);
  const grants = await db
    .select()
    .from(isoOptionGrants)
    .where(
      and(
        eq(isoOptionGrants.householdId, householdId),
        inArray(isoOptionGrants.accountId, accountIds),
      ),
    )
    .orderBy(isoOptionGrants.grantDate, isoOptionGrants.label);
  const details = await db
    .select()
    .from(isoOptionAccountDetails)
    .where(
      and(
        eq(isoOptionAccountDetails.householdId, householdId),
        inArray(isoOptionAccountDetails.accountId, accountIds),
      ),
    );
  const valuations = await db
    .select()
    .from(isoOptionValuations)
    .where(
      and(
        eq(isoOptionValuations.householdId, householdId),
        inArray(isoOptionValuations.accountId, accountIds),
        lte(isoOptionValuations.asOf, asOf),
      ),
    )
    .orderBy(isoOptionValuations.asOf);
  const grantIds = grants.map((grant) => grant.id);
  const exercises =
    grantIds.length > 0
      ? await db
          .select()
          .from(isoOptionExercises)
          .where(
            and(
              eq(isoOptionExercises.householdId, householdId),
              inArray(isoOptionExercises.grantId, grantIds),
              lte(isoOptionExercises.exerciseDate, asOf),
            ),
          )
          .orderBy(isoOptionExercises.exerciseDate)
      : [];

  const exercisesByGrant = new Map<string, typeof exercises>();
  for (const exercise of exercises) {
    const list = exercisesByGrant.get(exercise.grantId) ?? [];
    list.push(exercise);
    exercisesByGrant.set(exercise.grantId, list);
  }

  const detailsByAccount = new Map(details.map((detail) => [detail.accountId, detail] as const));

  return accounts.map((account) => {
    const accountLegacyGrants = grants.filter((grant) => grant.accountId === account.id);
    const detail = detailsByAccount.get(account.id);
    const employerName = detail?.employerName ?? accountLegacyGrants[0]?.employerName ?? null;
    const employerRelationship =
      detail?.employerRelationship ?? accountLegacyGrants[0]?.employerRelationship ?? "current";
    const employmentEndDate =
      detail?.employmentEndDate ?? accountLegacyGrants[0]?.employmentEndDate ?? null;
    const postTerminationExerciseDays =
      detail?.postTerminationExerciseDays ??
      accountLegacyGrants[0]?.postTerminationExerciseDays ??
      90;
    const exerciseDeadline =
      employerRelationship === "former" && employmentEndDate
        ? addDays(employmentEndDate, postTerminationExerciseDays)
        : null;
    const exerciseWindowExpired =
      exerciseDeadline !== null && compareIsoDate(asOf, exerciseDeadline) > 0;
    const vestingAsOf =
      employerRelationship === "former" && employmentEndDate
        ? minIsoDate(asOf, employmentEndDate)
        : asOf;
    const accountValuations = valuations
      .filter((valuation) => valuation.accountId === account.id)
      .map((valuation) => ({
        id: valuation.id,
        asOf: valuation.asOf,
        fmv: toNumber(valuation.fmv),
        sharePrice: valuation.sharePrice === null ? null : toNumber(valuation.sharePrice),
        notes: valuation.notes,
      }));
    const latestValuation = accountValuations.at(-1) ?? null;
    const price = latestValuation?.sharePrice ?? latestValuation?.fmv ?? null;
    const accountGrants = accountLegacyGrants.map((grant) => {
      const totalShares = grant.totalShares;
      const vestingSchedule = normalizeVestingSchedule(grant.vestingSchedule);
      const vestedShares = vestedSharesForGrant({
        totalShares,
        vestingStartDate: grant.vestingStartDate,
        schedule: vestingSchedule,
        asOf: vestingAsOf,
      });
      const grantExercises = exercisesByGrant.get(grant.id) ?? [];
      const exercisedShares = grantExercises.reduce((sum, exercise) => sum + exercise.shares, 0);
      const ownedVestedShares = Math.min(exercisedShares, vestedShares);
      const ownedUnvestedShares = Math.max(0, exercisedShares - vestedShares);
      const unexercisedVestedShares = Math.max(0, vestedShares - exercisedShares);
      const unvestedShares = Math.max(0, totalShares - vestedShares);
      const exercisableShares = exerciseWindowExpired
        ? 0
        : grant.earlyExerciseAllowed && employerRelationship === "current"
          ? Math.max(0, totalShares - exercisedShares)
          : unexercisedVestedShares;
      const outstandingVestedShares = exerciseWindowExpired ? 0 : unexercisedVestedShares;
      const forfeitedShares =
        employerRelationship === "former"
          ? Math.max(0, totalShares - exercisedShares - outstandingVestedShares)
          : 0;
      const strikePrice = toNumber(grant.strikePrice);
      const exerciseCost = grantExercises.reduce(
        (sum, exercise) =>
          sum +
          exercise.shares *
            (exercise.exercisePrice === null ? strikePrice : toNumber(exercise.exercisePrice)),
        0,
      );
      const ownedUnvestedCost = ownedUnvestedShares * strikePrice;
      const optionIntrinsicValue =
        price === null ? 0 : outstandingVestedShares * Math.max(0, price - strikePrice);
      const exercisedShareValue =
        price === null ? ownedUnvestedCost : ownedVestedShares * price + ownedUnvestedCost;
      const totalValue = optionIntrinsicValue + exercisedShareValue;
      return {
        id: grant.id,
        label: grant.label,
        grantDate: grant.grantDate,
        vestingStartDate: grant.vestingStartDate,
        vestingSchedule,
        earlyExerciseAllowed: grant.earlyExerciseAllowed,
        expirationDate: grant.expirationDate,
        totalShares,
        strikePrice,
        vestedShares,
        unvestedShares,
        exercisableShares,
        exercisedShares,
        ownedVestedShares,
        ownedUnvestedShares,
        outstandingVestedShares,
        forfeitedShares,
        isExerciseWindowExpired: exerciseWindowExpired,
        exerciseCost,
        exercisedShareValue,
        optionIntrinsicValue,
        totalValue,
        intrinsicValue: optionIntrinsicValue,
        exercises: grantExercises.map((exercise) => ({
          id: exercise.id,
          exerciseDate: exercise.exerciseDate,
          shares: exercise.shares,
          exercisePrice: exercise.exercisePrice === null ? null : toNumber(exercise.exercisePrice),
          fmvAtExercise: exercise.fmvAtExercise === null ? null : toNumber(exercise.fmvAtExercise),
          notes: exercise.notes,
        })),
      };
    });
    return {
      accountId: account.id,
      accountName: account.name,
      employerName,
      employerRelationship,
      employmentEndDate,
      postTerminationExerciseDays,
      postTerminationExerciseDeadline: exerciseDeadline,
      latestFmv: latestValuation?.fmv ?? null,
      latestSharePrice: latestValuation?.sharePrice ?? null,
      latestValuationDate: latestValuation?.asOf ?? null,
      totalShares: accountGrants.reduce((sum, grant) => sum + grant.totalShares, 0),
      vestedShares: accountGrants.reduce((sum, grant) => sum + grant.vestedShares, 0),
      unvestedShares: accountGrants.reduce((sum, grant) => sum + grant.unvestedShares, 0),
      exercisableShares: accountGrants.reduce((sum, grant) => sum + grant.exercisableShares, 0),
      exercisedShares: accountGrants.reduce((sum, grant) => sum + grant.exercisedShares, 0),
      ownedVestedShares: accountGrants.reduce((sum, grant) => sum + grant.ownedVestedShares, 0),
      ownedUnvestedShares: accountGrants.reduce((sum, grant) => sum + grant.ownedUnvestedShares, 0),
      outstandingVestedShares: accountGrants.reduce(
        (sum, grant) => sum + grant.outstandingVestedShares,
        0,
      ),
      exercisedShareValue: accountGrants.reduce((sum, grant) => sum + grant.exercisedShareValue, 0),
      exerciseCost: accountGrants.reduce((sum, grant) => sum + grant.exerciseCost, 0),
      optionIntrinsicValue: accountGrants.reduce(
        (sum, grant) => sum + grant.optionIntrinsicValue,
        0,
      ),
      totalValue: accountGrants.reduce((sum, grant) => sum + grant.totalValue, 0),
      intrinsicValue: accountGrants.reduce((sum, grant) => sum + grant.optionIntrinsicValue, 0),
      grants: accountGrants,
      valuations: accountValuations.slice(-5).reverse(),
    };
  });
}

export async function isoOptionAccountValues(
  householdId: string,
  asOf: string,
): Promise<Map<string, number>> {
  const summaries = await listIsoOptionSummaries(householdId, asOf);
  return new Map(summaries.map((summary) => [summary.accountId, summary.totalValue]));
}

export async function isoOptionAccountValuesByMonth(
  householdId: string,
  months: string[],
): Promise<Map<string, Map<string, number>>> {
  const entries = await Promise.all(
    months.map(async (month) => {
      const values = await isoOptionAccountValues(householdId, monthEndFromMonth(month));
      return [month, values] as const;
    }),
  );
  return new Map(entries);
}

export async function listIsoOptionCompensationForYear(
  householdId: string,
  year: number,
): Promise<IsoOptionYearCompensation> {
  const months = Array.from(
    { length: 12 },
    (_, i) => `${year}-${String(i + 1).padStart(2, "0")}-01`,
  );
  const priorMonth = `${year - 1}-12-01`;
  const summaries = await Promise.all([
    listIsoOptionSummaries(householdId, monthEndFromMonth(priorMonth)),
    ...months.map((month) => listIsoOptionSummaries(householdId, monthEndFromMonth(month))),
  ]);
  const latestAccounts = await listIsoOptionSummaries(
    householdId,
    new Date().toISOString().slice(0, 10),
  );
  const yearEndAccounts = summaries.at(-1) ?? [];
  const priceByAccount = new Map(
    latestAccounts.map(
      (account) => [account.accountId, account.latestSharePrice ?? account.latestFmv] as const,
    ),
  );

  const monthly: IsoOptionMonthlyCompensation[] = [];
  for (let i = 0; i < months.length; i++) {
    const previous = summaries[i] ?? [];
    const current = summaries[i + 1] ?? [];
    const previousGrants = new Map(
      previous.flatMap((account) => account.grants.map((grant) => [grant.id, grant] as const)),
    );
    const compensation = current.reduce((accountSum, account) => {
      const price = priceByAccount.get(account.accountId) ?? null;
      if (price === null) return accountSum;
      return (
        accountSum +
        account.grants.reduce((grantSum, grant) => {
          const previousVested = previousGrants.get(grant.id)?.vestedShares ?? 0;
          const newlyVested = Math.max(0, grant.vestedShares - previousVested);
          return grantSum + newlyVested * Math.max(0, price - grant.strikePrice);
        }, 0)
      );
    }, 0);
    monthly.push({
      month: months[i]!,
      compensation,
      vestedShares: current.reduce((sum, account) => sum + account.vestedShares, 0),
      unvestedShares: current.reduce((sum, account) => sum + account.unvestedShares, 0),
      exercisableShares: current.reduce((sum, account) => sum + account.exercisableShares, 0),
      exercisedShares: current.reduce((sum, account) => sum + account.exercisedShares, 0),
      ownedVestedShares: current.reduce((sum, account) => sum + account.ownedVestedShares, 0),
      ownedUnvestedShares: current.reduce((sum, account) => sum + account.ownedUnvestedShares, 0),
      outstandingVestedShares: current.reduce(
        (sum, account) => sum + account.outstandingVestedShares,
        0,
      ),
      forfeitedShares: current.reduce(
        (sum, account) =>
          sum + account.grants.reduce((grantSum, grant) => grantSum + grant.forfeitedShares, 0),
        0,
      ),
      exerciseCost: current.reduce((sum, account) => sum + account.exerciseCost, 0),
    });
  }

  const accounts = yearEndAccounts;
  return {
    year,
    compensation: monthly.reduce((sum, month) => sum + month.compensation, 0),
    vestedShares: accounts.reduce((sum, account) => sum + account.vestedShares, 0),
    unvestedShares: accounts.reduce((sum, account) => sum + account.unvestedShares, 0),
    exercisableShares: accounts.reduce((sum, account) => sum + account.exercisableShares, 0),
    exercisedShares: accounts.reduce((sum, account) => sum + account.exercisedShares, 0),
    ownedVestedShares: accounts.reduce((sum, account) => sum + account.ownedVestedShares, 0),
    ownedUnvestedShares: accounts.reduce((sum, account) => sum + account.ownedUnvestedShares, 0),
    outstandingVestedShares: accounts.reduce(
      (sum, account) => sum + account.outstandingVestedShares,
      0,
    ),
    forfeitedShares: accounts.reduce(
      (sum, account) =>
        sum + account.grants.reduce((grantSum, grant) => grantSum + grant.forfeitedShares, 0),
      0,
    ),
    exerciseCost: accounts.reduce((sum, account) => sum + account.exerciseCost, 0),
    ownedShareValue: accounts.reduce((sum, account) => sum + account.exercisedShareValue, 0),
    optionSpreadValue: accounts.reduce((sum, account) => sum + account.optionIntrinsicValue, 0),
    totalValue: accounts.reduce((sum, account) => sum + account.totalValue, 0),
    monthly,
    accounts,
  };
}

function toNumber(n: string | number | null | undefined): number {
  if (n === null || n === undefined) return 0;
  if (typeof n === "number") return n;
  const parsed = Number(n);
  return Number.isFinite(parsed) ? parsed : 0;
}

function monthEndFromMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m!, 0));
  return d.toISOString().slice(0, 10);
}

function normalizeVestingSchedule(value: unknown): {
  type: "monthly" | "quarterly" | "annual";
  durationMonths: number;
  cliffMonths: number;
} {
  if (!value || typeof value !== "object") {
    return { type: "monthly", durationMonths: 48, cliffMonths: 12 };
  }
  const record = value as Record<string, unknown>;
  const type = record.type === "quarterly" || record.type === "annual" ? record.type : "monthly";
  const durationMonths =
    typeof record.durationMonths === "number" && record.durationMonths > 0
      ? record.durationMonths
      : 48;
  const cliffMonths =
    typeof record.cliffMonths === "number" && record.cliffMonths >= 0 ? record.cliffMonths : 12;
  return { type, durationMonths, cliffMonths };
}

function vestedSharesForGrant({
  totalShares,
  vestingStartDate,
  schedule,
  asOf,
}: {
  totalShares: number;
  vestingStartDate: string | null;
  schedule: {
    type: "monthly" | "quarterly" | "annual";
    durationMonths: number;
    cliffMonths: number;
  };
  asOf: string;
}): number {
  if (!vestingStartDate) return 0;
  const start = new Date(`${vestingStartDate}T00:00:00Z`);
  const end = new Date(`${asOf}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  const elapsedMonths =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth()) +
    (end.getUTCDate() >= start.getUTCDate() ? 0 : -1);
  if (elapsedMonths < schedule.cliffMonths) return 0;
  const vestingMonths = Math.min(schedule.durationMonths, elapsedMonths);
  const intervalMonths = schedule.type === "annual" ? 12 : schedule.type === "quarterly" ? 3 : 1;
  const vestedIntervals = Math.floor(vestingMonths / intervalMonths);
  const totalIntervals = Math.max(1, Math.ceil(schedule.durationMonths / intervalMonths));
  return Math.min(totalShares, Math.floor((totalShares * vestedIntervals) / totalIntervals));
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function compareIsoDate(a: string, b: string): number {
  return a.localeCompare(b);
}

function minIsoDate(a: string, b: string): string {
  return compareIsoDate(a, b) <= 0 ? a : b;
}
