import { GlassToggle } from "./glass-toggle";
import { ThemeToggle } from "./theme-toggle";

export function SettingsAppearance() {
  return (
    <section
      className="flex flex-col gap-4 border-t border-[color:var(--color-border)] pt-8"
      aria-label="Appearance"
    >
      <h2 className="font-display text-xl">Appearance</h2>
      <div className="flex flex-wrap items-center gap-3">
        <GlassToggle />
        <ThemeToggle showLabel />
      </div>
    </section>
  );
}
