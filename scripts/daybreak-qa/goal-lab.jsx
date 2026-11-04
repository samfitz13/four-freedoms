import { createRoot } from "react-dom/client";
import { NewGoalLauncher } from "../../app/(app)/[freedom]/_financial/new-goal-launcher";
import { AssumptionsLauncher } from "../../app/(app)/[freedom]/_financial/assumptions-launcher";
import { GoalLinksLauncher } from "../../app/(app)/[freedom]/_financial/goal-links-launcher";
import { UpdateProgressForm } from "../../app/(app)/[freedom]/_financial/goals-forms";
import { AppearanceControls } from "../../components/ui/appearance-controls";
import { financialGoalFixtures, fiPlanFixture } from "./goal-fixtures.mjs";
const { goalAccounts, goalDefaults, goalDerived } = financialGoalFixtures();
const scenario = new URLSearchParams(location.search).get("case") ?? "";

globalThis.__qaPath = "/financial/goals";
createRoot(document.getElementById("root")).render(
  <>
    <div className="daybreak-scene" aria-hidden />
    <div className="daybreak-shell">
      <header className="daybreak-shell-top">
        <span className="brand-mark">freedom / four</span>
        <AppearanceControls />
      </header>
      <main className="daybreak-workspace">
        <div className="goals-workspace">
          <h1>Goal controls</h1>
          <div className="goals-actions">
            <NewGoalLauncher currency="USD" accounts={goalAccounts} />
            <AssumptionsLauncher
              defaults={goalDefaults}
              derived={goalDerived}
              currency="USD"
              hasGoal
              view={fiPlanFixture(scenario)}
              birthDate={scenario === "calendar" ? null : "1991-02-15"}
            />
            <GoalLinksLauncher
              goalId="qa-linked"
              accounts={goalAccounts}
              initial={{
                linkMode: "accounts",
                linkedAccountIds: ["qa-brokerage"],
                linkedClass: null,
                invert: false,
              }}
            />
          </div>
          <UpdateProgressForm id="qa-trip" currentProgress={6000} currency="USD" />
        </div>
      </main>
    </div>
  </>,
);
