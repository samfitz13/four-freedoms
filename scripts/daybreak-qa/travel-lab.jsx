import { useState } from "react";
import { createRoot } from "react-dom/client";
import { TravelWorkspace } from "../../app/(app)/[freedom]/_location/travel-workspace";
import { AppearanceControls } from "../../components/ui/appearance-controls";
import { AppNav, FreedomNav } from "../../app/(app)/app-nav";
import { travelFixtures } from "./travel-fixtures.mjs";

const fixtures = travelFixtures();
globalThis.__qaPath = "/location/travel";

function TravelLab() {
  const [empty, setEmpty] = useState(false);
  return (
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
            <button className="daybreak-button mb-6" onClick={() => setEmpty(!empty)}>
              {empty ? "Show populated fixture" : "Show empty fixture"}
            </button>
            <TravelWorkspace
              key={String(empty)}
              places={empty ? [] : fixtures.places}
              trips={empty ? [] : fixtures.trips}
              stays={empty ? [] : fixtures.stays}
              today="2026-10-17"
            />
          </main>
        </div>
      </div>
    </>
  );
}

createRoot(document.getElementById("root")).render(<TravelLab />);
