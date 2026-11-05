"use client";

import { useMemo, useState, type FormEvent } from "react";
import { PaystubKind } from "@/lib/freedoms/enums";
import { computeNet, sumLocal, sumStateFli, sumStateIncome } from "@/lib/freedoms/paystub-math";
import { MoneyInput, parseMoney } from "@/components/ui/money-input";
import { Modal } from "@/components/ui/modal";
import { StatePicker, stateName } from "@/components/ui/state-picker";
import { addPaystub, deletePaystub, updatePaystub } from "./income-actions";
import type { ActionResult, PaystubRow, StateTaxEntry } from "./types";

const kindOptions: Array<{ value: PaystubKind; label: string }> = [
  { value: PaystubKind.Regular, label: "Regular" },
  { value: PaystubKind.Bonus, label: "Bonus" },
  { value: PaystubKind.Rsu, label: "RSU" },
  { value: PaystubKind.Correction, label: "Correction" },
  { value: PaystubKind.Final, label: "Final" },
];

const emptyRow = (year: number): PaystubRow => ({
  id: "",
  payDate: `${year}-01-01`,
  kind: PaystubKind.Regular,
  employer: null,
  gross: 0,
  federalIncomeTax: 0,
  socialSecurity: 0,
  medicare: 0,
  additionalMedicare: 0,
  benefits: 0,
  otherIncome: 0,
  net: 0,
  employee401k: 0,
  employeeRoth401k: 0,
  employerMatch: 0,
  hsa: 0,
  otherPretax: 0,
  otherPosttax: 0,
  stateTaxes: [],
  netOverridden: false,
  notes: null,
});

export function PaystubModal({
  open,
  onClose,
  row,
  year,
  currency,
}: {
  open: boolean;
  onClose: () => void;
  row: PaystubRow | null;
  year: number;
  currency: string;
}) {
  const initial = row ?? emptyRow(year);
  const isEdit = Boolean(row);
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);
  const [stateTaxes, setStateTaxes] = useState<StateTaxEntry[]>(initial.stateTaxes);
  const [money, setMoney] = useState({
    gross: initial.gross,
    federalIncomeTax: initial.federalIncomeTax,
    socialSecurity: initial.socialSecurity,
    medicare: initial.medicare,
    additionalMedicare: initial.additionalMedicare,
    employee401k: initial.employee401k,
    employeeRoth401k: initial.employeeRoth401k,
    hsa: initial.hsa,
    otherPretax: initial.otherPretax,
    otherPosttax: initial.otherPosttax,
    benefits: initial.benefits,
    otherIncome: initial.otherIncome,
    net: initial.net,
  });
  const [netOverridden, setNetOverridden] = useState(initial.netOverridden);

  const computedNet = useMemo(() => computeNet({ ...money, stateTaxes }), [money, stateTaxes]);
  const drift = money.net - computedNet;

  function setMoneyField(field: keyof typeof money, value: number) {
    setMoney((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    const result = isEdit ? await updatePaystub(null, formData) : await addPaystub(null, formData);
    setPending(false);
    setState(result);
    if (result.ok) onClose();
  }

  async function handleDelete() {
    if (!initial.id) return;
    setPending(true);
    const formData = new FormData();
    formData.set("id", initial.id);
    await deletePaystub(formData);
    setPending(false);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit paystub" : "Add paystub"}
      description="Enter the paycheck once. Net is computed from the lines unless you explicitly override it."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="flex max-h-[75vh] flex-col overflow-y-auto">
        {isEdit ? <input type="hidden" name="id" value={initial.id} /> : null}
        <input type="hidden" name="stateTaxes" value={JSON.stringify(stateTaxes)} />
        <input
          type="hidden"
          name="net"
          value={(netOverridden ? money.net : computedNet).toFixed(2)}
        />
        {netOverridden ? <input type="hidden" name="netOverridden" value="on" /> : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            name="payDate"
            label="Pay date"
            type="date"
            defaultValue={initial.payDate}
            required
          />
          <label className="flex flex-col gap-1">
            <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
              Kind
            </span>
            <select
              name="kind"
              defaultValue={initial.kind}
              className="daybreak-field min-h-11 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--glass-control)] px-2 text-sm focus:border-[color:var(--color-foreground)]"
            >
              {kindOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <Field
            name="employer"
            label="Employer"
            defaultValue={initial.employer ?? ""}
            className="sm:col-span-2"
          />
        </div>

        <Section title="Income">
          <MoneyInputTracked
            name="gross"
            label="Gross"
            value={money.gross}
            currency={currency}
            onChange={(value) => setMoneyField("gross", value)}
          />
          <MoneyInputTracked
            name="otherIncome"
            label="Other income"
            value={money.otherIncome}
            currency={currency}
            onChange={(value) => setMoneyField("otherIncome", value)}
          />
        </Section>

        <Section title="Federal taxes">
          <MoneyInputTracked
            name="federalIncomeTax"
            label="Federal income"
            value={money.federalIncomeTax}
            currency={currency}
            onChange={(value) => setMoneyField("federalIncomeTax", value)}
          />
          <MoneyInputTracked
            name="socialSecurity"
            label="Social Security"
            value={money.socialSecurity}
            currency={currency}
            onChange={(value) => setMoneyField("socialSecurity", value)}
          />
          <MoneyInputTracked
            name="medicare"
            label="Medicare"
            value={money.medicare}
            currency={currency}
            onChange={(value) => setMoneyField("medicare", value)}
          />
          <MoneyInputTracked
            name="additionalMedicare"
            label="Additional Medicare"
            value={money.additionalMedicare}
            currency={currency}
            onChange={(value) => setMoneyField("additionalMedicare", value)}
          />
        </Section>

        <StateTaxesSection
          stateTaxes={stateTaxes}
          setStateTaxes={setStateTaxes}
          currency={currency}
        />

        <Section title="Pre-tax deductions">
          <MoneyInputTracked
            name="employee401k"
            label="401(k)"
            value={money.employee401k}
            currency={currency}
            onChange={(value) => setMoneyField("employee401k", value)}
          />
          <MoneyInputTracked
            name="employeeRoth401k"
            label="Roth 401(k)"
            value={money.employeeRoth401k}
            currency={currency}
            onChange={(value) => setMoneyField("employeeRoth401k", value)}
          />
          <MoneyInputTracked
            name="hsa"
            label="HSA"
            value={money.hsa}
            currency={currency}
            onChange={(value) => setMoneyField("hsa", value)}
          />
          <MoneyInputTracked
            name="otherPretax"
            label="Other pre-tax"
            value={money.otherPretax}
            currency={currency}
            onChange={(value) => setMoneyField("otherPretax", value)}
          />
        </Section>

        <Section title="Post-tax deductions">
          <MoneyInputTracked
            name="benefits"
            label="Benefits"
            value={money.benefits}
            currency={currency}
            onChange={(value) => setMoneyField("benefits", value)}
          />
          <MoneyInputTracked
            name="otherPosttax"
            label="Other post-tax"
            value={money.otherPosttax}
            currency={currency}
            onChange={(value) => setMoneyField("otherPosttax", value)}
          />
          <MoneyInput
            name="employerMatch"
            label="Employer match"
            defaultValue={initial.employerMatch}
            currency={currency}
          />
        </Section>

        <section className="daybreak-panel mt-5 flex flex-col gap-3 p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                Net
              </span>
              <span className="font-display text-3xl tabular-nums">
                {formatCurrency(netOverridden ? money.net : computedNet, currency)}
              </span>
              {netOverridden && Math.abs(drift) > 1 ? (
                <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                  Δ {formatCurrency(drift, currency)} vs computed
                </span>
              ) : null}
            </div>
            <label className="flex items-center gap-2 font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
              <input
                type="checkbox"
                checked={netOverridden}
                onChange={(e) => setNetOverridden(e.target.checked)}
              />
              Override
            </label>
          </div>
          {netOverridden ? (
            <MoneyInputTracked
              name="manualNetDisplay"
              label="Manual net"
              value={money.net}
              currency={currency}
              onChange={(value) => setMoneyField("net", value)}
            />
          ) : null}
        </section>

        <label className="mt-5 flex flex-col gap-1">
          <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
            Notes
          </span>
          <textarea
            name="notes"
            defaultValue={initial.notes ?? ""}
            rows={3}
            className="daybreak-field rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--glass-control)] p-2 text-sm focus:border-[color:var(--color-foreground)]"
          />
        </label>

        <footer className="sticky bottom-0 mt-5 flex items-center justify-between gap-3 border-t border-[color:var(--color-border)] bg-[color:var(--color-paper)] pt-4">
          <div>
            {state?.ok === false ? (
              <p className="text-sm text-[color:var(--color-accent-warning,#9a3412)]">
                {state.error}
              </p>
            ) : state?.ok ? (
              <p className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                Saved.
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            {isEdit ? (
              <button
                type="button"
                disabled={pending}
                onClick={handleDelete}
                className="daybreak-button font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-accent-warning,#9a3412)]"
              >
                Delete
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="daybreak-button text-sm text-[color:var(--color-ink-soft)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="daybreak-button inline-flex min-h-11 items-center bg-[color:var(--glass-primary)] px-4 text-sm text-[color:var(--glass-primary-ink)] disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </footer>
      </form>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="daybreak-panel mt-5 p-6">
      <h3 className="font-display mb-3 text-lg tracking-tight">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}

function Field({
  name,
  label,
  type = "text",
  defaultValue,
  required = false,
  className = "",
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
        {label}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className="daybreak-field min-h-11 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--glass-control)] px-2 text-sm focus:border-[color:var(--color-foreground)]"
      />
    </label>
  );
}

function MoneyInputTracked({
  name,
  label,
  value,
  currency,
  onChange,
}: {
  name: string;
  label: string;
  value: number;
  currency: string;
  onChange: (value: number) => void;
}) {
  return (
    <span
      onBlurCapture={(e) => {
        const input = e.target as HTMLInputElement;
        if (input?.tagName === "INPUT") onChange(parseMoney(input.value));
      }}
    >
      <MoneyInput name={name} label={label} defaultValue={value} currency={currency} />
    </span>
  );
}

function StateTaxesSection({
  stateTaxes,
  setStateTaxes,
  currency,
}: {
  stateTaxes: StateTaxEntry[];
  setStateTaxes: (value: StateTaxEntry[]) => void;
  currency: string;
}) {
  function update(index: number, next: StateTaxEntry) {
    setStateTaxes(stateTaxes.map((entry, i) => (i === index ? next : entry)));
  }

  return (
    <section className="daybreak-panel mt-5 p-6">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="font-display text-lg tracking-tight">State taxes</h3>
        <button
          type="button"
          onClick={() => setStateTaxes([...stateTaxes, { state: "NY", income: 0 }])}
          className="daybreak-button font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]"
        >
          + Add state
        </button>
      </div>
      <div className="flex flex-col gap-4">
        {stateTaxes.map((entry, index) => (
          <fieldset
            key={`${entry.state}:${index}`}
            className="border border-[color:var(--color-border)] p-3"
          >
            <legend className="px-1 font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
              {stateName(entry.state)}
            </legend>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatePicker
                value={entry.state}
                onChange={(state) => update(index, { ...entry, state })}
              />
              <MoneyStateField
                name={`state-${index}-income`}
                label="Income tax"
                value={entry.income}
                currency={currency}
                onChange={(income) => update(index, { ...entry, income })}
              />
              <MoneyStateField
                name={`state-${index}-fli`}
                label="FLI"
                value={entry.fli ?? 0}
                currency={currency}
                onChange={(fli) => update(index, { ...entry, fli })}
              />
              <MoneyStateField
                name={`state-${index}-disability`}
                label="Disability"
                value={entry.disability ?? 0}
                currency={currency}
                onChange={(disability) => update(index, { ...entry, disability })}
              />
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <p className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                  Localities
                </p>
                <button
                  type="button"
                  onClick={() =>
                    update(index, {
                      ...entry,
                      local: [...(entry.local ?? []), { jurisdiction: "", amount: 0 }],
                    })
                  }
                  className="daybreak-button font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]"
                >
                  + Add locality
                </button>
              </div>
              {(entry.local ?? []).map((local, localIndex) => (
                <div key={localIndex} className="grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
                  <label className="flex flex-col gap-1">
                    <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                      Jurisdiction
                    </span>
                    <input
                      defaultValue={local.jurisdiction}
                      onBlur={(e) => {
                        const localRows = [...(entry.local ?? [])];
                        localRows[localIndex] = {
                          ...local,
                          jurisdiction: e.currentTarget.value.trim(),
                        };
                        update(index, { ...entry, local: localRows });
                      }}
                      className="daybreak-field min-h-11 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--glass-control)] px-2 text-sm focus:border-[color:var(--color-foreground)]"
                    />
                  </label>
                  <MoneyStateField
                    name={`state-${index}-local-${localIndex}`}
                    label="Amount"
                    value={local.amount}
                    currency={currency}
                    onChange={(amount) => {
                      const localRows = [...(entry.local ?? [])];
                      localRows[localIndex] = { ...local, amount };
                      update(index, { ...entry, local: localRows });
                    }}
                  />
                  <button
                    type="button"
                    aria-label={`Remove ${local.jurisdiction || "locality"}`}
                    onClick={() => {
                      const localRows = [...(entry.local ?? [])];
                      localRows.splice(localIndex, 1);
                      update(index, { ...entry, local: localRows });
                    }}
                    className="daybreak-button self-end font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-accent-warning,#9a3412)]"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              aria-label={`Remove ${stateName(entry.state)} taxes`}
              onClick={() => setStateTaxes(stateTaxes.filter((_, i) => i !== index))}
              className="daybreak-button mt-3 font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-accent-warning,#9a3412)]"
            >
              Remove state
            </button>
          </fieldset>
        ))}
      </div>
      <p className="mt-3 font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] tabular-nums">
        State total ·{" "}
        {formatCurrency(
          sumStateIncome(stateTaxes) + sumStateFli(stateTaxes) + sumLocal(stateTaxes),
          currency,
        )}
      </p>
    </section>
  );
}

function MoneyStateField({
  name,
  label,
  value,
  currency,
  onChange,
}: {
  name: string;
  label: string;
  value: number;
  currency: string;
  onChange: (value: number) => void;
}) {
  return (
    <span
      onBlurCapture={(e) => {
        const input = e.target as HTMLInputElement;
        if (input?.tagName === "INPUT") onChange(parseMoney(input.value));
      }}
    >
      <MoneyInput name={name} label={label} defaultValue={value} currency={currency} />
    </span>
  );
}

function formatCurrency(value: number, currency: string): string {
  return value.toLocaleString(undefined, { style: "currency", currency, maximumFractionDigits: 2 });
}
