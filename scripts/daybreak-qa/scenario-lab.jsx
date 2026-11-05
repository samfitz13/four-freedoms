import { createRoot } from "react-dom/client";
import { FiScenarioComparison } from "../../components/freedoms/financial/fi-scenario-comparison";
import { buildFiReturnScenarios } from "../../lib/freedoms/fi-scenarios";
import { financialGoalFixtures } from "./goal-fixtures.mjs";
import { fiPlanFixture } from "./goal-fixtures.mjs";

const { goalDerived, goalInvestedSeries } = financialGoalFixtures();
const scenario = new URLSearchParams(location.search).get("case");
const history = {
  ...goalDerived.returnHistory,
  monthsObserved: scenario === "short" ? 4 : scenario === "none" ? 0 : 12,
  annualNominalReturn: scenario === "none" ? null : scenario === "negative" ? -0.05 : 0.119,
};
const scenarios = buildFiReturnScenarios({
  projection: {
    startMonth: "2026-10-01",
    startBalance: scenario === "met" ? 1600000 : 193800,
    monthlyContribution: scenario === "horizon" ? 0 : 2800,
    realReturn: scenario === "horizon" ? 0 : 0.05,
    withdrawalRate: 0.04,
    targetAnnualSpend: 60000,
  },
  history,
  inflationRate: 0.03,
  downsideReduction: 0.02,
});
const retirement = ["retirement", "short-retirement"].includes(scenario)
  ? fiPlanFixture(scenario)
  : null;
const actual = goalInvestedSeries.map(({ month, value }) => ({ month, balance: value }));
if (scenario === "met") actual.at(-1).balance = 1600000;

createRoot(document.getElementById("root")).render(
  <>
    <div className="daybreak-scene" aria-hidden />
    <div className="daybreak-shell">
      <main className="daybreak-workspace">
        <div className="goals-workspace">
          <section className="daybreak-panel goals-fi">
            <h1>Return scenarios</h1>
            <FiScenarioComparison
              scenarios={retirement?.scenarios ?? scenarios}
              stress={retirement?.stress}
              returnHistory={history}
              chart={{
                birthDate: scenario === "age" ? "1991-02-15" : null,
                actualSeries: actual,
                todayMonth: "2026-10-01",
                currency: "USD",
                milestones: [
                  {
                    id: "qa-trip",
                    title: "A longer summer abroad",
                    targetDate: "2027-06-01",
                    targetAmount: 20000,
                    status: "active",
                  },
                ],
              }}
            />
          </section>
        </div>
      </main>
    </div>
  </>,
);
