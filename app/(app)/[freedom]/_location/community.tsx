import { listConnectionVisits, listConnections, listPlaces } from "@/lib/db/queries/location";
import { isConnectionOnCadence } from "@/lib/freedoms/location-community";
import { archiveConnection, logVisit, promoteToHabit } from "./community-actions";
import { ConnectionForm } from "./connection-form";

export async function LocationCommunityTab({ householdId }: { householdId: string }) {
  const [connections, visits, places] = await Promise.all([
    listConnections(householdId),
    listConnectionVisits(householdId, 20),
    listPlaces(householdId),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <header className="daybreak-section-head flex flex-col gap-3 border-b border-[color:var(--color-border)] pb-6">
        <h2 className="font-display text-2xl tracking-tight">Community</h2>
        <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">
          People, places, cadence. Belonging is scored only where you choose a cadence.
        </p>
      </header>

      <section className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[color:var(--color-border)] text-left font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
              <th className="py-2 pr-4 font-normal">Name</th>
              <th className="py-2 pr-4 font-normal">Kind</th>
              <th className="py-2 pr-4 font-normal">Place</th>
              <th className="py-2 pr-4 font-normal">Cadence</th>
              <th className="py-2 pr-4 font-normal">Last seen</th>
              <th className="py-2 pr-4 font-normal">Status</th>
              <th className="py-2 text-right font-normal">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--color-border)]">
            {connections.map((row) => (
              <tr key={row.id}>
                <td className="font-display py-3 pr-4 text-base">{row.name}</td>
                <td className="py-3 pr-4">{row.kind}</td>
                <td className="py-3 pr-4">{row.placeName ?? "—"}</td>
                <td className="py-3 pr-4">{row.cadence ?? "—"}</td>
                <td className="py-3 pr-4 font-sans text-xs tabular-nums">
                  {row.lastSeenOn ?? "never"}
                </td>
                <td className="py-3 pr-4">
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden
                      className="h-2 w-2 rounded-full"
                      style={{
                        background: isConnectionOnCadence(row.cadence, row.lastSeenOn)
                          ? "var(--color-freedom-location)"
                          : "var(--color-border)",
                      }}
                    />
                    <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                      {row.cadence
                        ? isConnectionOnCadence(row.cadence, row.lastSeenOn)
                          ? "on"
                          : "off"
                        : "unset"}
                    </span>
                  </span>
                </td>
                <td className="py-3">
                  <div className="flex justify-end gap-3">
                    <form action={logVisit}>
                      <input type="hidden" name="connectionId" value={row.id} />
                      <button className="daybreak-button font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                        Saw today
                      </button>
                    </form>
                    <form action={promoteToHabit}>
                      <input type="hidden" name="connectionId" value={row.id} />
                      <button className="daybreak-button font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                        Habit
                      </button>
                    </form>
                    <form action={archiveConnection}>
                      <input type="hidden" name="id" value={row.id} />
                      <button className="daybreak-button font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                        Archive
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {connections.length === 0 ? (
          <p className="mt-4 text-sm text-[color:var(--color-ink-soft)]">No connections yet.</p>
        ) : null}
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="font-display text-xl">Recent visits</h3>
        <ul className="flex flex-col divide-y divide-[color:var(--color-border)]">
          {visits.map((visit) => (
            <li key={visit.id} className="flex items-baseline justify-between gap-4 py-3 text-sm">
              <span>{visit.connectionName}</span>
              <span className="font-sans text-xs text-[color:var(--color-ink-soft)] tabular-nums">
                {visit.occurredOn}
                {visit.placeName ? ` · ${visit.placeName}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="daybreak-panel flex flex-col gap-4 p-6">
        <h3 className="font-display text-xl">Add connection</h3>
        <ConnectionForm places={places} />
      </section>
    </div>
  );
}
