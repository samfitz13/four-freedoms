import { GlassToggle } from "./glass-toggle";
import { ThemeToggle } from "./theme-toggle";

export function AppearanceControls() {
  return (
    <div className="daybreak-public-controls">
      <GlassToggle />
      <ThemeToggle />
    </div>
  );
}
