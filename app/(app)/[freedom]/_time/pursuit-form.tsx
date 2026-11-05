import type { TimePursuit } from "@/lib/db/schema";
import { createPursuit, updatePursuit } from "./pursuits-actions";

export function PursuitForm({ pursuit }: { pursuit?: TimePursuit }) {
  const action = pursuit ? updatePursuit : createPursuit;
  return (
    <form action={action} className="daybreak-panel grid gap-3 p-6">
      {pursuit ? <input type="hidden" name="id" value={pursuit.id} /> : null}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
          Name
        </span>
        <input
          name="name"
          required
          defaultValue={pursuit?.name}
          className="daybreak-field border-b border-[color:var(--color-border)] bg-[color:var(--glass-control)] py-1 focus:border-[color:var(--color-foreground)]"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
            Kind
          </span>
          <select
            name="kind"
            defaultValue={pursuit?.kind ?? "work"}
            className="daybreak-field border-b border-[color:var(--color-border)] bg-[color:var(--glass-control)] py-1 focus:border-[color:var(--color-foreground)]"
          >
            {["work", "play", "care", "rest", "admin"].map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
            Target / wk
          </span>
          <input
            name="weeklyTargetHours"
            type="number"
            min={0}
            max={168}
            step={0.25}
            defaultValue={pursuit?.weeklyTargetHours ?? ""}
            className="daybreak-field border-b border-[color:var(--color-border)] bg-[color:var(--glass-control)] py-1 font-sans tabular-nums focus:border-[color:var(--color-foreground)]"
          />
        </label>
        <label className="flex items-end gap-2 pb-1 text-sm">
          <input name="matters" type="checkbox" defaultChecked={pursuit?.matters ?? true} />
          <span>Matters</span>
        </label>
      </div>
      <input name="colorVar" type="hidden" defaultValue={pursuit?.colorVar} />
      <button
        type="submit"
        className="daybreak-button justify-self-start border border-[color:var(--color-border)] px-3 py-1 font-sans text-xs tracking-normal hover:bg-[color:var(--color-paper-soft)]"
      >
        {pursuit ? "Save pursuit" : "Add pursuit"}
      </button>
    </form>
  );
}
