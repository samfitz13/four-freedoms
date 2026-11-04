import { createRoot } from "react-dom/client";
import { HabitTracker } from "../../app/(app)/[freedom]/_time/habits";
import { AppNav, FreedomNav } from "../../app/(app)/app-nav";
import { AppearanceControls } from "../../components/ui/appearance-controls";
import { habitFixtures } from "./habit-fixtures.mjs";

globalThis.__qaPath = "/time/habits";
const fixture = habitFixtures();
if (window.location.hash === "#legacy") {
  fixture.habits = [
    {
      ...fixture.habits[0],
      title: "Legacy rhythm",
      linkKind: "body_weight",
      pursuitId: "qa-archived",
      pursuit: null,
    },
  ];
}
createRoot(document.getElementById("root")).render(
  <>
    <div className="daybreak-scene" aria-hidden />
    <div className="daybreak-shell">
      <header className="daybreak-shell-top">
        <span className="brand-mark">freedom / four</span>
        <AppearanceControls />
      </header>
      <div className="daybreak-shell-body">
        <aside className="daybreak-sidebar">
          <FreedomNav />
          <AppNav />
        </aside>
        <main className="daybreak-workspace">
          <HabitTracker {...fixture} />
        </main>
      </div>
    </div>
  </>,
);
