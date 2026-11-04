import { createRoot } from "react-dom/client";
import { FiProjectionChart } from "../../components/freedoms/financial/fi-projection-chart";
import { planMonthlySeries } from "../../lib/freedoms/fi-projection";
import { financialGoalFixtures } from "./goal-fixtures.mjs";

const { goalDefaults, goalFixtures, goalInvestedSeries } = financialGoalFixtures();
const scenario = new URLSearchParams(location.search).get("scenario");
const actual = ["no-statements", "single"].includes(scenario)
  ? []
  : goalInvestedSeries.map(({ month, value }) => ({ month, balance: value }));
const plan = planMonthlySeries({
  startMonth: "2026-10-01",
  startBalance: ["already-fi", "single"].includes(scenario) ? 1600000 : 193800,
  monthlyContribution: scenario === "horizon" ? 0 : goalDefaults.monthlyContribution,
  realReturn: scenario === "horizon" ? 0 : goalDefaults.realReturn,
  withdrawalRate: goalDefaults.withdrawalRate,
  targetAnnualSpend: goalDefaults.annualSpend,
  horizonYears: scenario === "single" ? 0 : 50,
});
if (scenario === "already-fi") actual.at(-1).balance = 1600000;
const milestones = [
  ...goalFixtures.filter(
    (goal) =>
      !["fi_number", "savings_rate_target"].includes(goal.kind) && goal.status !== "archived",
  ),
  {
    id: "qa-before",
    title: "A past target",
    targetDate: "2020-01-01",
    targetAmount: 5000,
    status: "achieved",
  },
  {
    id: "qa-after",
    title: "A later chapter with a deliberately long name to test wrapping",
    targetDate: "2099-12-31",
    targetAmount: 80000,
    status: "active",
  },
  {
    id: "qa-same",
    title: "Another summer target",
    targetDate: "2027-06-15",
    targetAmount: 2000,
    status: "active",
  },
].map((goal) => ({
  ...goal,
  targetAmount: goal.targetAmount === null ? null : Number(goal.targetAmount),
}));

createRoot(document.getElementById("root")).render(
  <>
    <div className="daybreak-scene" aria-hidden />
    <div className="daybreak-shell">
      <main className="daybreak-workspace">
        <div className="goals-workspace">
          <section className="daybreak-panel goals-fi">
            <h1>Investment path</h1>
            <FiProjectionChart
              planSeries={plan.series}
              actualSeries={actual}
              fiNumber={plan.fiNumber}
              fiMonth={plan.fiMonth}
              todayMonth="2026-10-01"
              currency="USD"
              milestones={milestones}
            />
          </section>
        </div>
      </main>
    </div>
  </>,
);
