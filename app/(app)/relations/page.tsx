import Link from "next/link";
import { requireUser } from "@/lib/auth-server";
import { getPrimaryHouseholdId } from "@/lib/db/scope";
import { computeCorrespondences, type Correspondence } from "@/lib/correspondences";
import { FREEDOMS, freedomMetas } from "@/lib/freedoms/constants";
import type { FreedomKey } from "@/lib/freedoms/types";
import { Sparkline } from "@/components/freedoms/sparkline";
import { CorrespondenceList } from "@/components/freedoms/correspondence-list";

export const metadata = { title: "Relations" };
export const dynamic = "force-dynamic";

export default async function RelationsPage() {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);
  const correspondences = await computeCorrespondences(householdId);

  return (
    <section className="flex flex-col gap-10">
      <Link href="/dashboard" className="daybreak-back-link">
        ← dashboard
      </Link>
      <header className="flex flex-col gap-3">
        <p className="eyebrow">Gridlines</p>
        <h1 className="font-display text-4xl tracking-tight">Relations between freedoms.</h1>
        <p className="max-w-2xl text-sm leading-6 text-[color:var(--color-ink-soft)]">
          A quiet matrix of the seams: money with place, place with health, time with recovery.
        </p>
      </header>

      <RelationMatrix correspondences={correspondences} />

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-2xl tracking-tight">All margin notes</h2>
        <CorrespondenceList correspondences={correspondences} />
      </section>
    </section>
  );
}

function RelationMatrix({ correspondences }: { correspondences: Correspondence[] }) {
  return (
    <div className="daybreak-panel grid grid-cols-2 gap-px overflow-hidden bg-[color:var(--color-border)] xl:grid-cols-4">
      {FREEDOMS.map((row) =>
        FREEDOMS.map((column) => {
          const same = row.key === column.key;
          const relation = same ? null : findRelation(correspondences, row.key, column.key);
          return (
            <section
              key={`${row.key}-${column.key}`}
              className={[
                "min-h-36 bg-[color:var(--color-paper)] p-4",
                same ? "bg-[color:var(--color-paper-soft)]" : "",
              ].join(" ")}
            >
              <p className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                {row.label} {same ? "" : "↔"} {same ? "" : column.label}
              </p>
              {same ? (
                <p className="font-display mt-5 text-lg tracking-tight">—</p>
              ) : relation ? (
                <div className="mt-4 flex flex-col gap-3">
                  {relation.series ? (
                    <Sparkline
                      series={relation.series}
                      color={freedomMetas[row.key].colorVar}
                      width={120}
                      height={28}
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="block h-[2px] w-12"
                      style={{ background: freedomMetas[row.key].colorVar }}
                    />
                  )}
                  <p className="text-sm leading-5">{relation.sentence}</p>
                </div>
              ) : (
                <p className="mt-5 text-sm leading-5 text-[color:var(--color-ink-soft)]">
                  Waiting for shared signal.
                </p>
              )}
            </section>
          );
        }),
      )}
    </div>
  );
}

function findRelation(rows: Correspondence[], a: FreedomKey, b: FreedomKey) {
  return rows.find((row) => row.pair.includes(a) && row.pair.includes(b)) ?? null;
}
