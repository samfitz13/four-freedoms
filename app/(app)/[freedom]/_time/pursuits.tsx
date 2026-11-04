import { computeTimeAllocation } from "@/lib/freedoms/time-allocation";
import { listTimePursuits } from "@/lib/db/queries/time";
import { archivePursuit } from "./pursuits-actions";
import { PursuitForm } from "./pursuit-form";

export async function TimePursuitsTab({ householdId }: { householdId: string }) {
  const [pursuits, allocation] = await Promise.all([
    listTimePursuits(householdId, true),
    computeTimeAllocation(householdId),
  ]);
  const actualById = new Map(allocation.map((row) => [row.pursuitId, row]));

  return (
    <div className="flex flex-col gap-8">
      <header className="daybreak-section-head flex flex-col gap-3 border-b border-[color:var(--color-border)] pb-6">
        <h2 className="font-display text-2xl tracking-tight">Pursuits</h2>
        <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">
          The buckets your time rolls into. Work, play, care, rest, and admin stay separate.
        </p>
      </header>
      <PursuitForm />
      <div className="daybreak-table overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[color:var(--color-border)] text-left font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
              <th className="py-2 pr-4 font-normal">Name</th>
              <th className="py-2 pr-4 font-normal">Kind</th>
              <th className="py-2 pr-4 font-normal">Matters</th>
              <th className="py-2 pr-4 font-normal">Target</th>
              <th className="py-2 pr-4 font-normal">7d</th>
              <th className="py-2 pr-4 font-normal">30d</th>
              <th className="py-2 text-right font-normal">Archive</th>
            </tr>
          </thead>
          <tbody>
            {pursuits.map((pursuit) => {
              const actual = actualById.get(pursuit.id);
              return (
                <tr key={pursuit.id} className="border-b border-[color:var(--color-border)]">
                  <td className="py-3 pr-4">
                    <span
                      className={pursuit.archivedAt ? "text-[color:var(--color-ink-soft)]" : ""}
                    >
                      {pursuit.name}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: pursuit.colorVar }}
                      />
                      {pursuit.kind}
                    </span>
                  </td>
                  <td className="py-3 pr-4">{pursuit.matters ? "yes" : "no"}</td>
                  <td className="py-3 pr-4 font-sans tabular-nums">
                    {pursuit.weeklyTargetHours
                      ? `${Number(pursuit.weeklyTargetHours).toFixed(1)}h`
                      : "—"}
                  </td>
                  <td className="py-3 pr-4 font-sans tabular-nums">
                    {(actual?.hours7 ?? 0).toFixed(1)}h
                  </td>
                  <td className="py-3 pr-4 font-sans tabular-nums">
                    {(actual?.hours30 ?? 0).toFixed(1)}h
                  </td>
                  <td className="py-3 text-right">
                    {!pursuit.archivedAt ? (
                      <form action={archivePursuit}>
                        <input type="hidden" name="id" value={pursuit.id} />
                        <button className="daybreak-button font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]">
                          Archive
                        </button>
                      </form>
                    ) : (
                      <span className="font-sans text-xs text-[color:var(--color-ink-soft)]">
                        archived
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
