// Synthetic rendering fixtures. This module never imports a database or credentials.
import { habitFixtures } from "./habit-fixtures.mjs";
import { financialGoalFixtures, fiPlanFixture } from "./goal-fixtures.mjs";
import { travelFixtures } from "./travel-fixtures.mjs";
const { goalFixtures, goalDerived, goalInvestedSeries, goalSavingsSeries } =
  financialGoalFixtures();
const series = Array.from({ length: 14 }, (_, i) => ({
  date: `2026-10-${String(i + 1).padStart(2, "0")}`,
  score: 52 + i * 2,
}));
const common = { score: 78, trend: 4, entriesThisWeek: 5, streak: 3, series };
const noActivity = { score: null, trend: null, entriesThisWeek: 0, streak: 0, series: [] };
const financial = {
  ...common,
  netWorth: 248600,
  netWorth30: 243100,
  delta30: 5500,
  savingsRate: 0.38,
  runwayMonths: 6.9,
  fiProgress: 0.2,
  invested: 176800,
};
const location = {
  ...common,
  currentPlace: "Boston",
  currentCountry: "United States",
  currentIsPreferred: true,
  daysAtCurrent: 21,
  currentRole: "primary",
  currentTimezone: "America/New_York",
  meanSatisfaction30: 8,
  preferredVisited12mo: 2,
  primaryResidenceName: "Boston",
  primaryResidenceStartedOn: "2024-01-01",
  yearsAtPrimary: 2,
  connectionsOnCadence: 0,
  connectionsWithCadence: 0,
  daysAwayYtd: 35,
  daysAway365: 40,
  nextTrip: null,
  yearPlaceBreakdown: [
    { placeId: "qa-place", placeName: "Boston", country: "United States", days: 21, share: 1 },
  ],
  components: { rootedness: 20, belonging: 0, exploration: 15, satisfaction: 24 },
};
const time = {
  ...common,
  mattersHours7: 14,
  totalHours7: 38,
  mattersShare7: 14 / 38,
  daysLogged7: 5,
  habitsHitThisWeek: 0,
  habitsTargetedThisWeek: 0,
  nonZeroKinds7: 3,
  components: { intention: 20, cadence: 0, balance: 15, coverage: 20 },
};
const health = {
  ...common,
  meanSleep30: 7.7,
  sleepVariance30: 0.2,
  trainingDays30: 4,
  trainingMinutes30: 190,
  trainingByKind30: { strength: 90, cardio: 100 },
  meanEnergy30: 7,
  meanRhr30: 58,
  meanRestingHr30: 58,
  latestWeightKg: 75,
  weightDelta30: null,
  latestBodyFatPct: null,
  components: { sleep: 27, trainingFrequency: 10, trainingVolume: 10, recovery: 15, energy: 7 },
};
const accounts = [
  {
    id: "qa-brokerage",
    householdId: "qa-household",
    name: "Sample brokerage",
    type: "brokerage",
    subtype: null,
    currency: "USD",
    institution: "Sample institution",
    archived: false,
    archivedAt: null,
    createdAt: new Date("2026-01-01"),
  },
  {
    id: "qa-checking",
    householdId: "qa-household",
    name: "Sample checking",
    type: "checking",
    subtype: null,
    currency: "USD",
    institution: null,
    archived: false,
    archivedAt: null,
    createdAt: new Date("2026-01-01"),
  },
];
const balances = accounts.map((account, i) => ({
  accountId: account.id,
  accountName: account.name,
  type: account.type,
  subtype: null,
  currency: "USD",
  balance: i ? 54800 : 193800,
  date: "2026-10-01",
  asOf: "2026-10-01",
  month: "2026-10-01",
}));
const flow = Array.from({ length: 8 }, (_, i) => ({
  month: `2026-${String(i + 3).padStart(2, "0")}-01`,
  income: 12800,
  expense: 7936,
  net: 4864,
  savingsRate: 0.38,
}));
const rollup = {
  month: "2026-10-01",
  hasData: true,
  netWorth: 248600,
  netWorthPrev: 243100,
  delta: 5500,
  deltaPct: 0.0226,
  composition: [
    { klass: "investments", value: 193800 },
    { klass: "cash", value: 54800 },
  ],
  netIncome: 12800,
  netIncomeFromPaystubs: 12800,
  netIncomeFromCashflow: 0,
  expenses: 7936,
  totalSaved: 4864,
  savingsRate: 0.38,
  savingsRateGoal: null,
  fiNumber: null,
  fiPercent: null,
  fiPercentDelta: null,
  swMonthly: null,
  swYearly: null,
  totalGains: 5500,
  rows: [],
};
const overview = {
  month: "2026-10-01",
  verdict: {
    health: "healthy",
    fi: "needs_target",
    attention: "clear",
    sentence: "More options, less obligation.",
  },
  activeAccounts: 2,
  kpis: {
    netWorth: 248600,
    netWorthDelta: 5500,
    netWorthDeltaPct: 0.0226,
    savedThisMonth: 4864,
    savingsRate: 0.38,
    gainLoss: 5500,
    fiProgress: null,
    runwayMonths: 6.9,
  },
  balanceSheet: {
    assets: [
      { label: "Investments", value: 193800, share: 0.78, klass: "investments" },
      { label: "Cash", value: 54800, share: 0.22, klass: "cash" },
    ],
    liabilities: [],
    netWorth: 248600,
  },
  runway: {
    months: 6.9,
    liquidCash: 54800,
    creditCardDebt: 0,
    availableCash: 54800,
    monthlyBurn: 7936,
    windowMonths: 3,
    basis: "actual_3mo",
  },
  movementBridge: {
    start: 243100,
    saved: 4864,
    employerMatch: 0,
    gainLoss: 636,
    debtDrag: 0,
    end: 248600,
  },
  incomeQuality: {
    paystubNet: 12800,
    cashflowIncome: 0,
    expenses: 7936,
    saved: 4864,
    savingsRate: 0.38,
    drift: null,
    paystubRows: 1,
    employerMatch: 0,
    savingsSeries: flow,
  },
  fiTrack: {
    fiNumber: null,
    invested: 176800,
    gap: null,
    progress: null,
    monthsToFi: null,
    monthlyContribution: null,
    annualSpend: null,
    withdrawalRate: null,
  },
  attention: [],
};
const derived = {
  avgMonthlyContribution: null,
  realizedAnnualReturn: null,
  monthsObserved: 0,
  oldestMonth: null,
  latestMonth: null,
  returnHistory: {
    annualNominalReturn: null,
    monthsObserved: 0,
    skippedTransitions: 0,
    startMonth: null,
    endMonth: null,
  },
  trailingContributions: {
    average: null,
    monthsObserved: 0,
    windowStart: "2025-10-01",
    windowEnd: "2026-09-01",
  },
};

function queryChain() {
  return new Proxy(
    {},
    {
      get(_target, key) {
        if (key === "then") return (resolve) => resolve([]);
        return () => queryChain();
      },
    },
  );
}

export function qaValue(name, schema = false) {
  if (name === "db") return queryChain();
  if (schema) return new Proxy({}, { get: (_target, key) => `${name}.${String(key)}` });
  if (name === "SUPPORTED_CURRENCIES") return ["USD", "EUR", "GBP"];
  if (name === "authClient")
    return {
      signIn: { magicLink: async () => ({ data: {}, error: null }) },
      signOut: async () => ({}),
    };
  return (...args) => {
    const empty = globalThis.__qaEmpty === true;
    if (/^\/location\/travel(?:\?|$)/.test(globalThis.__qaPath ?? "")) {
      const travel = travelFixtures();
      if (name === "listTrips") return empty ? [] : travel.trips;
      if (name === "listTripStays") return empty ? [] : travel.stays;
      if (name === "listPlaces") return empty ? [] : travel.places;
    }
    const goalsPage = /^\/financial\/goals(?:\?|$)/.test(globalThis.__qaPath ?? "");
    const goalScenario = new URL(
      globalThis.__qaPath ?? "/",
      "https://fixture.test",
    ).searchParams.get("qa-goals");
    if (name === "getHouseholdFiPlan") return fiPlanFixture(goalScenario ?? "", empty);
    if (goalsPage) {
      if (name === "listFinancialGoals")
        return empty
          ? []
          : goalFixtures.map((goal) =>
              goal.kind === "fi_number" && goalScenario === "horizon"
                ? {
                    ...goal,
                    params: {
                      ...goal.params,
                      realReturn: 0,
                      monthlyContribution: 0,
                      useManualContribution: true,
                    },
                  }
                : goal.kind === "fi_number" && goalScenario === "manual"
                  ? { ...goal, params: { ...goal.params, useManualContribution: true } }
                  : goal,
            );
      const noStatements = empty || goalScenario === "no-statements";
      if (name === "getDerivedFiInputs") return noStatements ? derived : goalDerived;
      if (name === "getInvestedBalanceSeries") return noStatements ? [] : goalInvestedSeries;
      if (name === "getSavingsRateSeries") return noStatements ? [] : goalSavingsSeries;
      if (name === "getTrailingSavingsRate")
        return {
          rate: noStatements ? null : 0.375,
          months: noStatements ? 0 : 12,
          totalSaved: noStatements ? 0 : 45000,
          netIncome: noStatements ? 0 : 120000,
        };
      if (noStatements && name === "currentInvestedBalance") return 0;
      if (noStatements && name === "latestBalances") return [];
    }
    if (name === "requireUser") return { id: "qa-user", email: "sample@example.test" };
    if (name === "getPrimaryHouseholdId") return "qa-household";
    if (name === "scopeForUser")
      return { primaryHouseholdId: "qa-household", householdIds: ["qa-household"] };
    if (name === "getBaseCurrency") return "USD";
    if (name === "getUserBirthDate") return goalScenario === "age" ? "1991-02-15" : null;
    if (name === "getFiGoalAssumptions") return {};
    if (name === "computeFinancialSummary")
      return empty
        ? {
            ...financial,
            ...noActivity,
            netWorth: null,
            netWorth30: null,
            delta30: null,
            savingsRate: null,
            runwayMonths: null,
            fiProgress: null,
            invested: null,
          }
        : financial;
    if (name === "computeLocationSummary")
      return empty
        ? {
            ...location,
            ...noActivity,
            currentPlace: null,
            currentCountry: null,
            daysAtCurrent: 0,
            primaryResidenceName: null,
            primaryResidenceStartedOn: null,
            yearsAtPrimary: null,
            meanSatisfaction30: null,
            preferredVisited12mo: 0,
            daysAwayYtd: 0,
            daysAway365: 0,
            yearPlaceBreakdown: [],
            components: { rootedness: 0, belonging: 0, exploration: 0, satisfaction: 0 },
          }
        : location;
    if (name === "computeTimeSummary")
      return empty
        ? {
            ...time,
            ...noActivity,
            mattersHours7: 0,
            totalHours7: 0,
            mattersShare7: null,
            daysLogged7: 0,
            nonZeroKinds7: 0,
            components: { intention: 0, cadence: 0, balance: 0, coverage: 0 },
          }
        : time;
    if (name === "computeHealthSummary")
      return empty
        ? {
            ...health,
            ...noActivity,
            meanSleep30: null,
            sleepVariance30: null,
            trainingDays30: 0,
            trainingMinutes30: 0,
            trainingByKind30: {},
            meanEnergy30: null,
            meanRhr30: null,
            meanRestingHr30: null,
            latestWeightKg: null,
            components: {
              sleep: 0,
              trainingFrequency: 0,
              trainingVolume: 0,
              recovery: 0,
              energy: 0,
            },
          }
        : health;
    if (name === "computeFinancialOverview" && !empty) {
      const state = new URL(globalThis.__qaPath ?? "/", "https://fixture.test").searchParams.get(
        "qa-attention",
      );
      if (state) {
        const attention =
          state === "clear"
            ? [
                {
                  title: "No obvious gaps",
                  detail: "The latest closed month is reconciled enough for a high-level read.",
                  href: "/financial/statements",
                },
              ]
            : state === "review"
              ? [
                  {
                    title: "FI assumptions missing",
                    detail: "Set annual spend and withdrawal assumptions.",
                    href: "/financial/goals",
                  },
                ]
              : state === "missing"
                ? [
                    {
                      title: "Closed statement missing",
                      detail: "Update the latest closed month.",
                      href: "/financial/statements",
                    },
                  ]
                : [];
        return {
          ...overview,
          attention,
          verdict: {
            ...overview.verdict,
            attention:
              state === "clear" ? "clear" : state === "missing" ? "missing_data" : "review",
          },
        };
      }
    }
    if (name === "computeFinancialOverview")
      return empty
        ? {
            ...overview,
            activeAccounts: 0,
            kpis: { ...overview.kpis, netWorth: null },
            balanceSheet: { assets: [], liabilities: [], netWorth: null },
          }
        : overview;
    if (name === "computeTodayStrip")
      return {
        place: empty ? null : "Boston",
        sleepHours: empty ? null : 7.7,
        deepWorkHours: empty ? null : 3.5,
        netWorth: empty ? null : 248600,
        notes: [],
      };
    if (name === "computeCorrespondences") return [];
    if (name === "listTimeHabits") return empty ? [] : habitFixtures().habits;
    if (name === "listTimePursuits")
      return empty || !globalThis.__qaPath?.includes("tab=habits") ? [] : habitFixtures().pursuits;
    if (name === "listAccounts") return empty ? [] : accounts;
    if (name === "latestBalances") return empty ? [] : balances;
    if (name === "currentInvestedBalance") return empty ? 0 : 193800;
    if (name === "cashflowByMonth") return empty ? [] : flow;
    if (name === "listLedger") return { rows: [], nextCursor: null, hasMore: false };
    if (name === "listIsoOptionCompensationForYear") return { accounts: [], total: 0 };
    if (["peerAccountsForTransfers", "isoOptionAccountValues"].includes(name)) return new Map();
    if (name === "isIsoOptionAccount") return false;
    if (name === "getDerivedFiInputs") return derived;
    if (name === "getTrailingSavingsRate") return null;
    if (name === "computeMonthlyRollup") return { ...rollup, hasData: !empty };
    if (name === "getCompositionHistory") return [];
    if (["netWorthSeries", "netWorthBreakdownSeries"].includes(name))
      return empty
        ? []
        : flow.map((row, i) => ({
            date: row.month,
            netWorth: 202400 + i * 6600,
            assets: 202400 + i * 6600,
            liabilities: 0,
          }));
    if (name === "wealthCategorySeries")
      return empty
        ? []
        : flow.map((row, i) => ({
            date: row.month,
            categories: { brokerage: 150000 + i * 6000, checking: 52400 + i * 600 },
            accounts: {},
          }));
    if (name === "assetAllocation")
      return empty
        ? []
        : [
            { bucket: "retirement", value: 104800 },
            { bucket: "equity_comp", value: 58000 },
            { bucket: "brokerage", value: 51400 },
            { bucket: "savings", value: 23200 },
            { bucket: "checking", value: 11200 },
          ];
    if (name === "listStatementMonths") return empty ? [] : ["2026-10-01", "2026-09-01"];
    if (name === "monthStart") return `${new Date(args[0]).toISOString().slice(0, 7)}-01`;
    if (name === "monthEnd") {
      const d = new Date(args[0]);
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
        .toISOString()
        .slice(0, 10);
    }
    if (name === "shiftMonth") {
      const d = new Date(args[0]);
      d.setUTCMonth(d.getUTCMonth() + args[1]);
      return d.toISOString().slice(0, 10);
    }
    if (name === "toNumber") return Number(args[0] ?? 0);
    if (name === "computeHabitScore") return { score: 0, hit: 0, targeted: 0 };
    if (name === "computeCadenceRollup") return { onCadence: 0, withCadence: 0, rows: [] };
    if (name.startsWith("ensure")) return undefined;
    if (name.startsWith("getPrimary") || name === "getLatestBodyMeasurement") return null;
    if (
      /^(create|update|delete|archive|save|seed|wipe|sync|toggle|upsert|import|connect|disconnect|set)/.test(
        name,
      )
    ) {
      const form = args.find((arg) => typeof FormData !== "undefined" && arg instanceof FormData);
      if (name === "updateBirthDate") {
        globalThis.__qaProfileActions ??= [];
        globalThis.__qaProfileActions.push(Object.fromEntries(form ?? []));
        if (globalThis.__qaPauseProfileAction)
          return new Promise((resolve) => {
            globalThis.__qaResolveProfileAction = () => resolve({ ok: true, message: "Saved." });
          });
        return Promise.resolve(
          globalThis.__qaFailProfileAction
            ? { ok: false, message: "Synthetic profile validation error" }
            : { ok: true, message: "Saved." },
        );
      }
      if (["createTrip", "updateTrip", "upsertStay", "archiveTrip"].includes(name)) {
        globalThis.__qaTravelActions ??= [];
        globalThis.__qaTravelActions.push({ name, data: Object.fromEntries(form ?? []) });
        if (globalThis.__qaFailTravelAction) throw new Error("Synthetic travel failure");
        if (globalThis.__qaPauseTravelAction)
          return new Promise((resolve) => {
            globalThis.__qaResolveTravelAction = resolve;
          });
        return Promise.resolve();
      }
      if (["createGoal", "setFiGoal", "setGoalLinks", "updateGoalProgress"].includes(name)) {
        globalThis.__qaGoalActions ??= [];
        globalThis.__qaGoalActions.push({
          name,
          data: Object.fromEntries(form ?? []),
          linkedAccountIds: form?.getAll("linkedAccountIds") ?? [],
        });
        if (globalThis.__qaPauseGoalAction)
          return new Promise((resolve) => {
            globalThis.__qaResolveGoalAction = () => resolve({ ok: true });
          });
        if (form?.get("title") === "Reject" || globalThis.__qaFailGoalAction)
          return Promise.resolve({ ok: false, error: "Synthetic goal validation error" });
      }
      if (["createHabit", "updateHabit", "toggleCheckin", "archiveHabit"].includes(name)) {
        globalThis.__qaHabitActions ??= [];
        globalThis.__qaHabitActions.push({ name, data: Object.fromEntries(form ?? []) });
        if (globalThis.__qaFailHabitAction) throw new Error("Synthetic action failure");
        if (form?.get("title") === "Reject")
          return Promise.resolve({ ok: false, error: "Synthetic habit validation error" });
        if (globalThis.__qaPauseHabitAction)
          return new Promise((resolve) => {
            globalThis.__qaResolveHabitAction = () => resolve({ ok: true });
          });
      }
      if (form?.get("name") === "Pending")
        return new Promise((resolve) => {
          globalThis.__qaResolveAction = () => resolve({ ok: true });
        });
      return Promise.resolve(
        form?.get("name") === "Reject"
          ? { ok: false, error: "Synthetic validation error" }
          : { ok: true },
      );
    }
    return [];
  };
}
