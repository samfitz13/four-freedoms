"use client";

import { useMemo, useState } from "react";
import { PaystubKind } from "@/lib/freedoms/enums";
import {
  sumLocal,
  sumStateFli,
  sumStateIncome,
  totalPaystubTaxes,
} from "@/lib/freedoms/paystub-math";
import { PaystubModal } from "./income-modal";
import type { MonthlyIncomeSummary, PaystubRow } from "./types";

const headerCell =
  "border-b border-[color:var(--color-border)] px-2 py-2 text-right font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]";
const monthFmt = new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" });

const kindLabels: Record<PaystubKind, string> = {
  [PaystubKind.Regular]: "reg",
  [PaystubKind.Bonus]: "bonus",
  [PaystubKind.Rsu]: "rsu",
  [PaystubKind.Correction]: "corr",
  [PaystubKind.Final]: "final",
};

export function IncomeGrid({
  rows,
  year,
  currency,
  monthly,
}: {
  rows: PaystubRow[];
  year: number;
  currency: string;
  monthly: MonthlyIncomeSummary[];
}) {
  const [modalRow, setModalRow] = useState<PaystubRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const monthlyByMonth = useMemo(
    () => new Map(monthly.map((m) => [m.month.slice(0, 7), m] as const)),
    [monthly],
  );
  const totals = useMemo(() => totalRows(rows), [rows]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-xl tracking-tight">Rows</h3>
          <p className="text-sm text-[color:var(--color-ink-soft)]">
            Click a row to edit the full paystub. State and locality taxes are handled in the modal.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setModalRow(null);
            setModalOpen(true);
          }}
          className="daybreak-button inline-flex min-h-11 items-center border border-[color:var(--color-border)] px-3 font-sans text-xs tracking-normal hover:bg-[color:var(--color-surface-muted,transparent)]"
        >
          + Add paystub
        </button>
      </div>

      <div className="overflow-x-auto border-y border-[color:var(--color-border)]">
        <table className="min-w-[1500px] border-collapse text-sm">
          <thead>
            <tr>
              <th className={`${headerCell} text-left`}>Date</th>
              <th className={`${headerCell} text-left`}>Kind</th>
              <th className={`${headerCell} text-left`}>Employer</th>
              <th className={headerCell}>Gross</th>
              <th className={headerCell}>Fed</th>
              <th className={headerCell}>SS</th>
              <th className={headerCell}>Med</th>
              <th className={headerCell}>Addl med</th>
              <th className={headerCell}>State</th>
              <th className={headerCell}>Local</th>
              <th className={headerCell}>FLI</th>
              <th className={headerCell}>Other</th>
              <th className={headerCell}>Benefits</th>
              <th className={headerCell}>401k</th>
              <th className={headerCell}>Roth</th>
              <th className={headerCell}>Match</th>
              <th className={headerCell}>HSA</th>
              <th className={headerCell}>Pretax</th>
              <th className={headerCell}>Posttax</th>
              <th className={headerCell}>Net</th>
              <th className={headerCell}>Tax %</th>
              <th className={headerCell}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const month = row.payDate.slice(0, 7);
              const prevMonth = rows[index - 1]?.payDate.slice(0, 7);
              const showMonth = month !== prevMonth;
              const summary = monthlyByMonth.get(month);
              return (
                <RowGroup
                  key={row.id}
                  row={row}
                  showMonth={showMonth}
                  summary={summary}
                  currency={currency}
                  onEdit={() => {
                    setModalRow(row);
                    setModalOpen(true);
                  }}
                />
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-display border-t border-[color:var(--color-border)] text-base tabular-nums">
              <td colSpan={3} className="px-2 py-3 font-sans text-xs tracking-normal">
                Totals
              </td>
              <td className="px-2 py-3 text-right">{formatMoney(totals.gross, currency)}</td>
              <td className="px-2 py-3 text-right">
                {formatMoney(totals.federalIncomeTax, currency)}
              </td>
              <td className="px-2 py-3 text-right">
                {formatMoney(totals.socialSecurity, currency)}
              </td>
              <td className="px-2 py-3 text-right">{formatMoney(totals.medicare, currency)}</td>
              <td className="px-2 py-3 text-right">
                {formatMoney(totals.additionalMedicare, currency)}
              </td>
              <td className="px-2 py-3 text-right">{formatMoney(totals.state, currency)}</td>
              <td className="px-2 py-3 text-right">{formatMoney(totals.local, currency)}</td>
              <td className="px-2 py-3 text-right">{formatMoney(totals.fli, currency)}</td>
              <td className="px-2 py-3 text-right">{formatMoney(totals.otherIncome, currency)}</td>
              <td className="px-2 py-3 text-right">{formatMoney(totals.benefits, currency)}</td>
              <td className="px-2 py-3 text-right">{formatMoney(totals.employee401k, currency)}</td>
              <td className="px-2 py-3 text-right">
                {formatMoney(totals.employeeRoth401k, currency)}
              </td>
              <td className="px-2 py-3 text-right">
                {formatMoney(totals.employerMatch, currency)}
              </td>
              <td className="px-2 py-3 text-right">{formatMoney(totals.hsa, currency)}</td>
              <td className="px-2 py-3 text-right">{formatMoney(totals.otherPretax, currency)}</td>
              <td className="px-2 py-3 text-right">{formatMoney(totals.otherPosttax, currency)}</td>
              <td className="px-2 py-3 text-right">{formatMoney(totals.net, currency)}</td>
              <td className="px-2 py-3 text-right">
                {totals.gross > 0
                  ? `${((totals.totalTaxes / totals.gross) * 100).toFixed(1)}%`
                  : "—"}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      {modalOpen ? (
        <PaystubModal
          key={modalRow?.id ?? "new"}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          row={modalRow}
          year={year}
          currency={currency}
        />
      ) : null}
    </section>
  );
}

function RowGroup({
  row,
  showMonth,
  summary,
  currency,
  onEdit,
}: {
  row: PaystubRow;
  showMonth: boolean;
  summary?: MonthlyIncomeSummary;
  currency: string;
  onEdit: () => void;
}) {
  return (
    <>
      {showMonth && summary ? <MonthSummaryRow summary={summary} currency={currency} /> : null}
      <PaystubTableRow row={row} currency={currency} onEdit={onEdit} />
    </>
  );
}

function MonthSummaryRow({
  summary,
  currency,
}: {
  summary: MonthlyIncomeSummary;
  currency: string;
}) {
  return (
    <tr className="border-b border-[color:var(--color-border)] bg-[color:var(--color-paper-soft)]">
      <td
        colSpan={23}
        className="px-2 py-2 font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] tabular-nums"
      >
        {monthLabel(summary.month)} · {summary.count} stubs · gross{" "}
        {summary.gross.toLocaleString(undefined, {
          style: "currency",
          currency,
          maximumFractionDigits: 0,
        })}{" "}
        · net{" "}
        {summary.net.toLocaleString(undefined, {
          style: "currency",
          currency,
          maximumFractionDigits: 0,
        })}{" "}
        · tax {summary.effectiveTax.toFixed(1)}%
      </td>
    </tr>
  );
}

function PaystubTableRow({
  row,
  currency,
  onEdit,
}: {
  row: PaystubRow;
  currency: string;
  onEdit: () => void;
}) {
  const totalTax = totalTaxes(row);
  return (
    <tr
      className="cursor-pointer border-b border-dashed border-[color:var(--color-border)] align-top hover:bg-[color:var(--color-paper-soft)]"
      onClick={onEdit}
    >
      <td className="px-2 py-3 text-left font-sans text-xs tabular-nums">{row.payDate}</td>
      <td className="px-2 py-3 text-left font-sans text-xs tracking-normal">
        {kindLabels[row.kind]}
      </td>
      <td className="font-display px-2 py-3 text-left">{row.employer ?? "Paystub"}</td>
      <Amount value={row.gross} currency={currency} />
      <Amount value={row.federalIncomeTax} currency={currency} />
      <Amount value={row.socialSecurity} currency={currency} />
      <Amount value={row.medicare} currency={currency} />
      <Amount value={row.additionalMedicare} currency={currency} />
      <Amount value={sumStateIncome(row.stateTaxes)} currency={currency} />
      <Amount value={sumLocal(row.stateTaxes)} currency={currency} />
      <Amount value={sumStateFli(row.stateTaxes)} currency={currency} />
      <Amount value={row.otherIncome} currency={currency} />
      <Amount value={row.benefits} currency={currency} />
      <Amount value={row.employee401k} currency={currency} />
      <Amount value={row.employeeRoth401k} currency={currency} />
      <Amount value={row.employerMatch} currency={currency} />
      <Amount value={row.hsa} currency={currency} />
      <Amount value={row.otherPretax} currency={currency} />
      <Amount value={row.otherPosttax} currency={currency} />
      <Amount value={row.net} currency={currency} strong />
      <td className="px-2 py-3 text-right font-sans text-xs text-[color:var(--color-ink-soft)] tabular-nums">
        {row.gross > 0 ? `${((totalTax / row.gross) * 100).toFixed(1)}%` : "—"}
      </td>
      <td className="px-2 py-3 text-right font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
        Edit
      </td>
    </tr>
  );
}

function Amount({
  value,
  currency,
  strong = false,
}: {
  value: number;
  currency: string;
  strong?: boolean;
}) {
  return (
    <td className={`px-2 py-3 text-right tabular-nums ${strong ? "font-display" : ""}`}>
      {value ? formatCurrency(value, currency) : "—"}
    </td>
  );
}

function formatMoney(value: number, currency: string): string {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
}

function monthLabel(month: string): string {
  return monthFmt.format(new Date(month + "T00:00:00Z"));
}

function formatCurrency(value: number, currency: string): string {
  return value.toLocaleString(undefined, { style: "currency", currency, maximumFractionDigits: 0 });
}

function totalTaxes(row: PaystubRow): number {
  return totalPaystubTaxes(row);
}

function totalRows(rows: PaystubRow[]) {
  return rows.reduce(
    (sum, row) => ({
      gross: sum.gross + row.gross,
      federalIncomeTax: sum.federalIncomeTax + row.federalIncomeTax,
      socialSecurity: sum.socialSecurity + row.socialSecurity,
      medicare: sum.medicare + row.medicare,
      additionalMedicare: sum.additionalMedicare + row.additionalMedicare,
      state: sum.state + sumStateIncome(row.stateTaxes),
      local: sum.local + sumLocal(row.stateTaxes),
      fli: sum.fli + sumStateFli(row.stateTaxes),
      otherIncome: sum.otherIncome + row.otherIncome,
      benefits: sum.benefits + row.benefits,
      employee401k: sum.employee401k + row.employee401k,
      employeeRoth401k: sum.employeeRoth401k + row.employeeRoth401k,
      employerMatch: sum.employerMatch + row.employerMatch,
      hsa: sum.hsa + row.hsa,
      otherPretax: sum.otherPretax + row.otherPretax,
      otherPosttax: sum.otherPosttax + row.otherPosttax,
      net: sum.net + row.net,
      totalTaxes: sum.totalTaxes + totalTaxes(row),
    }),
    {
      gross: 0,
      federalIncomeTax: 0,
      socialSecurity: 0,
      medicare: 0,
      additionalMedicare: 0,
      state: 0,
      local: 0,
      fli: 0,
      otherIncome: 0,
      benefits: 0,
      employee401k: 0,
      employeeRoth401k: 0,
      employerMatch: 0,
      hsa: 0,
      otherPretax: 0,
      otherPosttax: 0,
      net: 0,
      totalTaxes: 0,
    },
  );
}
