import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-server";
import { getPrimaryHouseholdId } from "@/lib/db/scope";
import { freedomMetas } from "@/lib/freedoms/constants";
import { isFreedomKey, workspaceUrl } from "./routing";
import type { WorkspaceSearchParams } from "./types";
import type { FreedomKey } from "@/lib/freedoms/types";
import { freedomModules } from "@/lib/freedoms";
import { computeFinancialOverview } from "@/lib/freedoms/financial-overview";
import { computeLocationSummary } from "@/lib/freedoms/location-summary";
import { computeTimeSummary } from "@/lib/freedoms/time-summary";
import { computeHealthSummary } from "@/lib/freedoms/health-summary";
import { getBaseCurrency } from "@/lib/freedoms/financial-settings";
import { computeCorrespondences, type Correspondence } from "@/lib/correspondences";
import { ComingSoonFreedom } from "@/components/freedoms/coming-soon";
import { CorrespondenceList } from "@/components/freedoms/correspondence-list";

import { FinancialOverview } from "./_financial/overview";
import { FinancialAccountsTab } from "./_financial/accounts";
import { FinancialWealthTab } from "./_financial/wealth";
import { FinancialCashflowTab } from "./_financial/cashflow";
import { FinancialIncomeTab } from "./_financial/income";
import { FinancialGoalsTab } from "./_financial/goals";
import { FinancialStatementsTab } from "./_financial/statements";
import { FinancialTabNav, isFinancialTab } from "./_financial/nav";
import type { FinancialTab } from "./_financial/types";

import { LocationOverview } from "./_location/overview";
import { LocationHomeTab } from "./_location/home";
import { LocationPropertiesTab } from "./_location/properties";
import { LocationTravelTab } from "./_location/travel";
import { LocationCommunityTab } from "./_location/community";
import { LocationPlacesTab } from "./_location/places";
import { LocationLogTab } from "./_location/log";
import { LocationTabNav, isLocationTab } from "./_location/nav";
import type { LocationTab } from "./_location/types";

import { TimeOverview } from "./_time/overview";
import { TimeAgendaTab } from "./_time/agenda";
import { TimeHabitsTab } from "./_time/habits";
import { TimePursuitsTab } from "./_time/pursuits";
import { TimeLogTab } from "./_time/log";
import { TimeTabNav, isTimeTab } from "./_time/nav";
import type { TimeTab } from "./_time/types";

import { HealthOverview } from "./_health/overview";
import { HealthTrainingTab } from "./_health/training";
import { HealthBodyTab } from "./_health/body";
import { HealthLogTab } from "./_health/log";
import { HealthTabNav, isHealthTab } from "./_health/nav";
import type { HealthTab } from "./_health/types";

export default async function FreedomWorkspace({
  params,
  searchParams,
}: {
  params: Promise<{ freedom: string; tab: string }>;
  searchParams: Promise<WorkspaceSearchParams>;
}) {
  const { freedom, tab } = await params;
  if (!isFreedomKey(freedom)) notFound();

  const user = await requireUser(workspaceUrl(freedom, tab, await searchParams));
  const meta = freedomMetas[freedom];
  const mod = freedomModules[freedom];
  const search = await searchParams;
  const month = typeof search.month === "string" ? search.month : undefined;
  const year = typeof search.year === "string" ? search.year : undefined;
  const view = typeof search.view === "string" ? search.view : undefined;
  const householdId = await getPrimaryHouseholdId(user.id);

  if (freedom === "financial") {
    const active: FinancialTab = tab && isFinancialTab(tab) ? tab : "overview";
    const [baseCurrency, overviewData, xrefs] = await Promise.all([
      getBaseCurrency(householdId),
      active === "overview" ? computeFinancialOverview(householdId) : Promise.resolve(null),
      active === "overview" ? crossRefs(householdId, freedom) : Promise.resolve([]),
    ]);

    return (
      <section className="flex flex-col gap-8">
        <BackLink />
        <FinancialTabNav active={active} />
        {active !== "overview" ? <h1 className="sr-only">Financial · {active}</h1> : null}
        {active === "overview" ? (
          <>
            <FinancialOverview meta={meta} baseCurrency={baseCurrency} data={overviewData!} />
            <FreedomCrossRefs rows={xrefs} />
          </>
        ) : active === "wealth" ? (
          <FinancialWealthTab householdId={householdId} baseCurrency={baseCurrency} />
        ) : active === "cashflow" ? (
          <FinancialCashflowTab householdId={householdId} baseCurrency={baseCurrency} />
        ) : active === "income" ? (
          <FinancialIncomeTab
            householdId={householdId}
            baseCurrency={baseCurrency}
            selectedYear={year}
          />
        ) : active === "statements" ? (
          <FinancialStatementsTab
            householdId={householdId}
            baseCurrency={baseCurrency}
            selectedMonth={month}
          />
        ) : active === "goals" ? (
          <FinancialGoalsTab
            householdId={householdId}
            baseCurrency={baseCurrency}
            userId={user.id}
          />
        ) : (
          <FinancialAccountsTab householdId={householdId} baseCurrency={baseCurrency} />
        )}
      </section>
    );
  }

  if (freedom === "location") {
    const active: LocationTab = tab && isLocationTab(tab) ? tab : "overview";
    const [data, xrefs] = await Promise.all([
      computeLocationSummary(householdId),
      active === "overview" ? crossRefs(householdId, freedom) : Promise.resolve([]),
    ]);
    return (
      <section className="flex flex-col gap-8">
        <BackLink />
        <LocationTabNav active={active} />
        {active !== "overview" ? <h1 className="sr-only">Location · {active}</h1> : null}
        {active === "overview" ? (
          <>
            <LocationOverview meta={meta} data={data} householdId={householdId} />
            <FreedomCrossRefs rows={xrefs} />
          </>
        ) : active === "home" ? (
          <LocationHomeTab householdId={householdId} />
        ) : active === "properties" ? (
          <LocationPropertiesTab householdId={householdId} />
        ) : active === "travel" ? (
          <LocationTravelTab householdId={householdId} />
        ) : active === "community" ? (
          <LocationCommunityTab householdId={householdId} />
        ) : active === "places" ? (
          <LocationPlacesTab householdId={householdId} />
        ) : (
          <LocationLogTab householdId={householdId} />
        )}
      </section>
    );
  }

  if (freedom === "time") {
    const active: TimeTab = tab && isTimeTab(tab) ? tab : "overview";
    const [data, xrefs] = await Promise.all([
      computeTimeSummary(householdId),
      active === "overview" ? crossRefs(householdId, freedom) : Promise.resolve([]),
    ]);
    return (
      <section className="flex flex-col gap-8">
        <BackLink />
        <TimeTabNav active={active} />
        {active !== "overview" ? <h1 className="sr-only">Time · {active}</h1> : null}
        {active === "overview" ? (
          <>
            <TimeOverview meta={meta} data={data} householdId={householdId} />
            <FreedomCrossRefs rows={xrefs} />
          </>
        ) : active === "agenda" ? (
          <TimeAgendaTab householdId={householdId} view={view} />
        ) : active === "habits" ? (
          <TimeHabitsTab householdId={householdId} />
        ) : active === "pursuits" ? (
          <TimePursuitsTab householdId={householdId} />
        ) : (
          <TimeLogTab householdId={householdId} />
        )}
      </section>
    );
  }

  if (freedom === "health") {
    const active: HealthTab = tab && isHealthTab(tab) ? tab : "overview";
    const [data, xrefs] = await Promise.all([
      computeHealthSummary(householdId),
      active === "overview" ? crossRefs(householdId, freedom) : Promise.resolve([]),
    ]);
    return (
      <section className="flex flex-col gap-8">
        <BackLink />
        <HealthTabNav active={active} />
        {active !== "overview" ? <h1 className="sr-only">Health · {active}</h1> : null}
        {active === "overview" ? (
          <>
            <HealthOverview meta={meta} data={data} householdId={householdId} />
            <FreedomCrossRefs rows={xrefs} />
          </>
        ) : active === "training" ? (
          <HealthTrainingTab householdId={householdId} />
        ) : active === "body" ? (
          <HealthBodyTab householdId={householdId} />
        ) : (
          <HealthLogTab householdId={householdId} />
        )}
      </section>
    );
  }

  if (mod.status === "coming-soon") {
    return (
      <section className="flex flex-col gap-8">
        <BackLink />
        <ComingSoonFreedom meta={meta} blurb={meta.blurb} />
      </section>
    );
  }

  notFound();
}

function BackLink() {
  return (
    <Link href="/dashboard" className="daybreak-back-link">
      ← dashboard
    </Link>
  );
}

async function crossRefs(householdId: string, freedom: FreedomKey) {
  const rows = await computeCorrespondences(householdId);
  return rows.filter((row) => row.pair.includes(freedom)).slice(0, 4);
}

function FreedomCrossRefs({ rows }: { rows: Correspondence[] }) {
  return (
    <section className="daybreak-panel flex flex-col gap-4 p-6">
      <h2 className="font-display text-2xl tracking-tight">Seen from the other freedoms</h2>
      <CorrespondenceList correspondences={rows} />
    </section>
  );
}
