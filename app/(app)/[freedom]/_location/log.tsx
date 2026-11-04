import { listConnections, listRecentSatisfactions, listStays } from "@/lib/db/queries/location";
import { logSatisfaction } from "./actions";

export async function LocationLogTab({ householdId }: { householdId: string }) {
  const [sat, stays, connections] = await Promise.all([
    listRecentSatisfactions(householdId, 30),
    listStays(householdId, 30),
    listConnections(householdId),
  ]);
  const connectionsById = new Map(
    connections.map((connection) => [connection.id, connection.name]),
  );

  return (
    <div className="flex flex-col gap-10">
      <header className="daybreak-section-head flex flex-col gap-3 border-b border-[color:var(--color-border)] pb-6">
        <h2 className="font-display text-2xl tracking-tight">Log</h2>
        <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">
          Daily satisfaction and stay history. One row per day — the form upserts.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h3 className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
          Log today
        </h3>
        <form action={logSatisfaction} className="flex flex-wrap items-baseline gap-4">
          <label htmlFor="sat" className="text-sm">
            Satisfaction (1–10)
          </label>
          <input
            id="sat"
            name="satisfaction"
            type="number"
            min={1}
            max={10}
            step={1}
            required
            className="daybreak-field w-20 border-b border-[color:var(--color-border)] bg-[color:var(--glass-control)] px-1 py-1 font-sans text-sm tabular-nums focus:border-[color:var(--color-foreground)]"
          />
          <input
            name="note"
            placeholder="Note (optional)"
            maxLength={500}
            className="daybreak-field min-w-[16rem] flex-1 border-b border-[color:var(--color-border)] bg-[color:var(--glass-control)] px-1 py-1 text-sm focus:border-[color:var(--color-foreground)]"
          />
          <div className="flex flex-wrap gap-2">
            {connections.map((connection) => (
              <label
                key={connection.id}
                className="inline-flex items-center gap-1 border border-[color:var(--color-border)] px-2 py-1 font-sans text-xs tracking-normal"
              >
                <input type="checkbox" name="withConnectionIds" value={connection.id} />
                {connection.name}
              </label>
            ))}
          </div>
          <button
            type="submit"
            className="daybreak-button border border-[color:var(--color-border)] px-3 py-1 font-sans text-xs tracking-normal hover:bg-[color:var(--color-surface-muted,transparent)]"
          >
            Save
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="font-display text-xl">Recent satisfaction</h3>
        {sat.length === 0 ? (
          <p className="text-sm text-[color:var(--color-ink-soft)]">No entries yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[color:var(--color-border)]">
            {sat.map((s) => (
              <li key={s.id} className="flex items-baseline justify-between gap-6 py-3">
                <span className="font-sans text-xs text-[color:var(--color-ink-soft)] tabular-nums">
                  {s.recordedOn}
                </span>
                <span className="flex-1 text-sm">
                  {s.satisfaction}/10
                  {s.placeName ? (
                    <span className="ml-3 font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                      {s.placeName}
                    </span>
                  ) : null}
                  {s.note ? (
                    <span className="ml-3 text-[color:var(--color-ink-soft)]">{s.note}</span>
                  ) : null}
                  {s.withConnectionIds.length ? (
                    <span className="ml-3 font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                      with{" "}
                      {s.withConnectionIds
                        .map((id) => connectionsById.get(id))
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="font-display text-xl">Stays</h3>
        {stays.length === 0 ? (
          <p className="text-sm text-[color:var(--color-ink-soft)]">No stays yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[color:var(--color-border)]">
            {stays.map((s) => (
              <li key={s.id} className="flex items-baseline justify-between gap-6 py-3">
                <span className="flex-1 text-sm">
                  {s.placeName}
                  {s.country ? (
                    <span className="ml-3 font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                      {s.country}
                    </span>
                  ) : null}
                </span>
                <span className="font-sans text-xs text-[color:var(--color-ink-soft)] tabular-nums">
                  {s.startedOn} → {s.endedOn ?? "present"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
