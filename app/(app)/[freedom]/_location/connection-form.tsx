import { DateInput } from "@/components/ui/date-input";
import { createConnection } from "./community-actions";

type PlaceOption = { id: string; name: string; country: string | null };

export function ConnectionForm({ places }: { places: PlaceOption[] }) {
  return (
    <form action={createConnection} className="daybreak-panel grid gap-4 p-6 sm:grid-cols-6">
      <Field label="Name" className="sm:col-span-2">
        <input name="name" required maxLength={120} className={controlClass} />
      </Field>
      <Field label="Kind">
        <select name="kind" defaultValue="friend" className={controlClass}>
          <option value="family">Family</option>
          <option value="friend">Friend</option>
          <option value="partner">Partner</option>
          <option value="community">Community</option>
          <option value="neighbor">Neighbor</option>
          <option value="mentor">Mentor</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <Field label="Place">
        <select name="placeId" className={controlClass}>
          <option value="">Unanchored</option>
          {places.map((place) => (
            <option key={place.id} value={place.id}>
              {place.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Cadence">
        <select name="cadence" className={controlClass}>
          <option value="">None</option>
          <option value="weekly">Weekly</option>
          <option value="biweekly">Biweekly</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </select>
      </Field>
      <Field label="Last seen">
        <DateInput name="lastSeenOn" className={controlClass} />
      </Field>
      <Field label="Note" className="sm:col-span-5">
        <input name="note" maxLength={500} className={controlClass} />
      </Field>
      <button
        type="submit"
        className="daybreak-button self-end border border-[color:var(--color-border)] px-3 py-2 font-sans text-xs tracking-normal"
      >
        Add
      </button>
    </form>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={["flex flex-col gap-1 text-sm", className].filter(Boolean).join(" ")}>
      <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
        {label}
      </span>
      {children}
    </label>
  );
}

const controlClass =
  "daybreak-field w-full border-b border-[color:var(--color-border)] bg-[color:var(--glass-control)] px-1 py-1 text-sm focus:border-[color:var(--color-foreground)]";
