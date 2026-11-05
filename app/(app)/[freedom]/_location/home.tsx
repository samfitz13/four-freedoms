import { listPlaces, listResidences } from "@/lib/db/queries/location";
import { archiveResidence } from "./residence-actions";
import { MoveResidenceForm, ResidenceEditDisclosure, ResidenceForm } from "./residence-form";

export async function LocationHomeTab({ householdId }: { householdId: string }) {
  const [places, residences] = await Promise.all([
    listPlaces(householdId),
    listResidences(householdId),
  ]);
  const active = residences.filter((row) => row.endedOn === null && row.role !== "former");

  return (
    <div className="flex flex-col gap-10">
      <header className="daybreak-section-head flex flex-col gap-3 border-b border-[color:var(--color-border)] pb-6">
        <h2 className="font-display text-2xl tracking-tight">Home</h2>
        <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">
          Residence is the rooted side of location: primary home, secondary places, household share,
          and the moves that separate one chapter from the next.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h3 className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
          Active residences
        </h3>
        {active.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {active.map((row) => (
              <article key={row.id} className="daybreak-panel p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-display text-xl">{row.placeName}</p>
                    <p className="font-sans text-xs text-[color:var(--color-ink-soft)] tabular-nums">
                      {row.role} · {row.tenure} · since {row.startedOn}
                    </p>
                  </div>
                  <span className="font-sans text-xs text-[color:var(--color-ink-soft)] tabular-nums">
                    {Number(row.householdSharePct).toFixed(0)}%
                  </span>
                </div>
                <p className="mt-4 text-sm text-[color:var(--color-ink-soft)]">
                  {row.costPerMonth
                    ? `${row.currency} ${Number(row.costPerMonth).toLocaleString()} / mo${row.tenure === "rent" ? " rent" : ""}`
                    : "No monthly cost recorded."}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[color:var(--color-ink-soft)]">No active residence yet.</p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="font-display text-xl">Timeline</h3>
        <ol className="flex flex-col divide-y divide-[color:var(--color-border)] border-y border-[color:var(--color-border)]">
          {residences.map((row) => (
            <li
              key={row.id}
              className="grid gap-3 py-3 sm:grid-cols-[1fr_max-content_max-content] sm:items-start"
            >
              <div>
                <p className="font-display text-lg">{row.placeName}</p>
                <p className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                  {row.role}
                  {row.country ? ` · ${row.country}` : ""}
                </p>
              </div>
              <span className="font-sans text-xs text-[color:var(--color-ink-soft)] tabular-nums">
                {row.startedOn} → {row.endedOn ?? "present"}
              </span>
              <form action={archiveResidence}>
                <input type="hidden" name="id" value={row.id} />
                <button className="daybreak-button font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]">
                  Close
                </button>
              </form>
              <ResidenceEditDisclosure places={places} residence={row} />
            </li>
          ))}
        </ol>
      </section>

      <section className="daybreak-panel flex flex-col gap-4 p-6">
        <h3 className="font-display text-xl">Move primary</h3>
        <MoveResidenceForm places={places} />
      </section>

      <section className="daybreak-panel flex flex-col gap-4 p-6">
        <h3 className="font-display text-xl">Add residence</h3>
        <ResidenceForm places={places} />
      </section>
    </div>
  );
}
