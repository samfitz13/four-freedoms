import { DateInput } from "@/components/ui/date-input";
import { createProperty } from "./properties-actions";

type PlaceOption = { id: string; name: string; country: string | null };
type AccountOption = { id: string; name: string; currency: string };

export function PropertyForm({
  places,
  accounts,
}: {
  places: PlaceOption[];
  accounts: AccountOption[];
}) {
  return (
    <form action={createProperty} className="daybreak-panel grid gap-4 p-6 sm:grid-cols-6">
      <Field label="Place" className="sm:col-span-2">
        <select name="placeId" required className={controlClass}>
          <option value="">Choose place</option>
          {places.map((place) => (
            <option key={place.id} value={place.id}>
              {place.name}
              {place.country ? ` · ${place.country}` : ""}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Use">
        <select name="use" defaultValue="owner_occupied" className={controlClass}>
          <option value="owner_occupied">Owner occupied</option>
          <option value="second_home">Second home</option>
          <option value="rental">Rental</option>
          <option value="investment">Investment</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <Field label="Account" className="sm:col-span-2">
        <select name="accountId" className={controlClass}>
          <option value="">Create inline account</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="New account">
        <input name="accountName" maxLength={80} className={controlClass} />
      </Field>
      <Field label="Acquired">
        <DateInput name="acquiredOn" required className={controlClass} />
      </Field>
      <Field label="Ownership %">
        <input
          name="ownershipPct"
          type="number"
          min="0"
          max="100"
          step="0.01"
          defaultValue="100"
          className={controlClass}
        />
      </Field>
      <Field label="Currency">
        <input name="currency" maxLength={3} defaultValue="USD" className={controlClass} />
      </Field>
      <Field label="Notes" className="sm:col-span-2">
        <input name="notes" maxLength={500} className={controlClass} />
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
