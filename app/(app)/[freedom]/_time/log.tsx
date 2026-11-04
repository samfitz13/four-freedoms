import { listTimeLogEntries, listTimePursuits } from "@/lib/db/queries/time";
import { upsertLogEntry } from "./log-actions";

export async function TimeLogTab({ householdId }: { householdId: string }) {
  const [entries, pursuits] = await Promise.all([
    listTimeLogEntries(householdId, 30),
    listTimePursuits(householdId),
  ]);
  const hoursByPursuit = new Map<string, number>();
  for (const entry of entries) {
    hoursByPursuit.set(
      entry.pursuitId,
      (hoursByPursuit.get(entry.pursuitId) ?? 0) + Number(entry.hours),
    );
  }
  const visiblePursuits = [...pursuits]
    .sort((a, b) => (hoursByPursuit.get(b.id) ?? 0) - (hoursByPursuit.get(a.id) ?? 0))
    .slice(0, 6);
  const entryByCell = new Map(
    entries.map((entry) => [`${entry.recordedOn}:${entry.pursuitId}`, entry]),
  );
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().slice(0, 10);
  });

  return (
    <div className="flex flex-col gap-10">
      <header className="daybreak-section-head flex flex-col gap-3 border-b border-[color:var(--color-border)] pb-6">
        <h2 className="font-display text-2xl tracking-tight">Log</h2>
        <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">
          Last 30 days by pursuit. Enter hours in a cell and save; zero clears the cell.
        </p>
      </header>

      {visiblePursuits.length === 0 ? (
        <p className="text-sm text-[color:var(--color-ink-soft)]">
          Add a pursuit first, then return here to fill the grid.
        </p>
      ) : (
        <div className="daybreak-table overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[color:var(--color-border)]">
                <th className="py-2 pr-4 text-left font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                  Day
                </th>
                {visiblePursuits.map((pursuit) => (
                  <th
                    key={pursuit.id}
                    className="py-2 pr-4 text-left font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]"
                  >
                    {pursuit.name}
                  </th>
                ))}
                <th className="py-2 text-right font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                  Total
                </th>
              </tr>
              <tr className="border-b border-[color:var(--color-border)]">
                <td className="py-2 pr-4 font-sans text-xs text-[color:var(--color-ink-soft)]">
                  30d total
                </td>
                {visiblePursuits.map((pursuit) => (
                  <td key={pursuit.id} className="py-2 pr-4 font-sans text-xs tabular-nums">
                    {(hoursByPursuit.get(pursuit.id) ?? 0).toFixed(1)}h
                  </td>
                ))}
                <td className="py-2 text-right font-sans text-xs tabular-nums">
                  {entries.reduce((sum, entry) => sum + Number(entry.hours), 0).toFixed(1)}h
                </td>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => {
                const total = visiblePursuits.reduce((sum, pursuit) => {
                  const entry = entryByCell.get(`${day}:${pursuit.id}`);
                  return sum + (entry ? Number(entry.hours) : 0);
                }, 0);
                return (
                  <tr key={day} className="border-b border-[color:var(--color-border)]">
                    <th className="py-2 pr-4 text-left font-sans text-xs text-[color:var(--color-ink-soft)] tabular-nums">
                      {day}
                    </th>
                    {visiblePursuits.map((pursuit) => {
                      const entry = entryByCell.get(`${day}:${pursuit.id}`);
                      return (
                        <td key={pursuit.id} className="py-2 pr-4">
                          <form action={upsertLogEntry} className="flex items-baseline gap-1">
                            <input type="hidden" name="pursuitId" value={pursuit.id} />
                            <input type="hidden" name="recordedOn" value={day} />
                            <input
                              name="hours"
                              type="number"
                              min={0}
                              max={24}
                              step={0.25}
                              defaultValue={entry ? Number(entry.hours).toFixed(2) : ""}
                              className="daybreak-field w-16 border-b border-[color:var(--color-border)] bg-[color:var(--glass-control)] font-sans text-xs tabular-nums focus:border-[color:var(--color-foreground)]"
                            />
                            <button className="daybreak-button font-sans text-xs text-[color:var(--color-ink-soft)]">
                              save
                            </button>
                          </form>
                        </td>
                      );
                    })}
                    <td className="py-2 text-right font-sans text-xs tabular-nums">
                      {total.toFixed(1)}h
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
