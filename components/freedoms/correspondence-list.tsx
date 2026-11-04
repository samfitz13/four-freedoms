import Link from "next/link";
import type { Correspondence } from "@/lib/correspondences";
import { freedomMetas } from "@/lib/freedoms/constants";
import { Sparkline } from "./sparkline";

export function CorrespondenceList({
  correspondences,
  limit,
}: {
  correspondences: Correspondence[];
  limit?: number;
}) {
  const rows = limit ? correspondences.slice(0, limit) : correspondences;
  if (rows.length === 0) {
    return (
      <p className="max-w-xl text-sm leading-6 text-[color:var(--color-ink-soft)]">
        Patterns appear after two or more freedoms have entries in the same week.
      </p>
    );
  }
  return (
    <ul className="grid gap-x-10 border-t border-[color:var(--color-border)] sm:grid-cols-2">
      {rows.map((row) => {
        const body = (
          <span className="flex min-h-20 flex-col justify-between gap-3 py-4">
            <span className="text-sm leading-6">{row.sentence}</span>
            <span className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold text-[color:var(--color-ink-soft)]">
                {row.pair.map((key) => freedomMetas[key].label).join(" ↔ ")}
              </span>
              {row.series ? (
                <Sparkline
                  series={row.series}
                  color={freedomMetas[row.pair[0]].colorVar}
                  width={96}
                  height={24}
                />
              ) : null}
            </span>
          </span>
        );
        return (
          <li key={row.key} className="border-b border-[color:var(--color-border)]">
            {row.href ? (
              <Link href={row.href} className="block hover:opacity-80">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}
