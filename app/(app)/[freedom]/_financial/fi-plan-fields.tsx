"use client";

import { useId, useState } from "react";
import type { FiPlanFormInputs } from "@/lib/freedoms/types";
import type { FiAccountCoverage } from "@/lib/freedoms/fi-allocation";
import { FI_ASSETS, FI_PLANNING_DEFAULTS } from "@/lib/freedoms/fi-plan-settings";
import type { FiPlanSettings } from "@/lib/freedoms/fi-plan-settings";

const labels = {
  usEquity: "US equities",
  developedEquity: "Developed international",
  emergingEquity: "Emerging markets",
  bonds: "Municipal bonds",
  cash: "Cash",
};

export function FiPlanFields({
  view,
  birthDate,
  portfolio,
}: {
  view?: FiPlanFormInputs;
  birthDate?: string | null;
  portfolio: boolean;
}) {
  const settings = view?.settings;
  const saved = settings?.version === 2 ? settings : null;
  const assumptions = saved?.assumptions ?? FI_PLANNING_DEFAULTS;
  return (
    <>
      {portfolio && (
        <fieldset className="goals-field-wide fi-plan-fields">
          <legend>Nominal annual planning returns</legend>
          <p className="fi-chart-note">
            Rounded planning defaults, not provider predictions. {assumptions.version}.
          </p>
          <div className="fi-input-grid">
            {[
              ["equitiesReturn", "Equities", assumptions.equities],
              ["bondsReturn", "Bonds", assumptions.bonds],
              ["cashReturn", "Cash", assumptions.cash],
              ["additionalFee", "Additional annual fee", assumptions.additionalFee],
            ].map(([name, label, value]) => (
              <label key={name} className="fi-input-label">
                {label} (%)
                <input
                  className="daybreak-field"
                  name={String(name)}
                  type="number"
                  step="0.01"
                  min={name === "additionalFee" ? 0 : -20}
                  max={name === "additionalFee" ? 10 : 30}
                  required
                  defaultValue={(Number(value) * 100).toFixed(2)}
                />
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <fieldset className="goals-field-wide fi-plan-fields">
        <legend>Included accounts</legend>
        {view?.allocation.coverage.some((a) => a.cashOnly) && (
          <p className="fi-chart-note">
            Include savings reserved for retirement as cash. Leave emergency funds and near-term
            spending out.
          </p>
        )}
        {view?.allocation.coverage
          .filter((a) => a.eligible && !a.archived)
          .map((account) => (
            <AllocationFields
              key={account.id}
              account={account}
              saved={saved}
              portfolio={portfolio}
            />
          ))}
        {view?.allocation.coverage
          .filter((a) => a.included && a.archived)
          .map((a) => (
            <p key={a.id} className="fi-chart-note">
              {a.name} (archived): retained from the last recorded statement
              {a.statementMonth ? ` (${a.statementMonth.slice(0, 7)})` : ""}, with no new account
              input.
            </p>
          ))}
        {view?.allocation.coverage.filter((a) => !a.eligible).length ? (
          <p className="fi-chart-note">
            Excluded from this spendable projection:{" "}
            {view.allocation.coverage
              .filter((a) => !a.eligible)
              .map((a) => a.name)
              .join(", ")}
            . Crypto, company equity, and options remain in net worth.
          </p>
        ) : null}
        <label className="goals-account-option">
          <input type="checkbox" name="confirmIncludedAccounts" value="true" required />I confirm
          the included accounts
        </label>
      </fieldset>
      <fieldset className="goals-field-wide fi-plan-fields">
        <legend>Retirement timing</legend>
        <p className="fi-chart-note">
          Leave both retirement and plan end blank for an accumulation plan.
        </p>
        {birthDate && (
          <p className="fi-chart-note">
            Ages resolve to the first monthly boundary at or after your birthday. Saved months stay
            fixed for the household.
          </p>
        )}
        <div className="fi-input-grid">
          <TimingField
            label="Retirement"
            monthName="retirementMonth"
            ageName="retirementAge"
            value={settings?.retirementMonth}
            birthDate={birthDate}
          />
          <TimingField
            label="Plan end"
            monthName="endMonth"
            ageName="endAge"
            value={settings?.endMonth}
            birthDate={birthDate}
          />
          <label className="fi-input-label">
            Monthly after-tax retirement income (optional)
            <input
              className="daybreak-field"
              name="monthlyRetirementIncome"
              type="number"
              min="0"
              step="0.01"
              defaultValue={settings?.monthlyRetirementIncome ?? 0}
            />
          </label>
          <TimingField
            label="Income starts"
            monthName="incomeStartMonth"
            ageName="incomeAge"
            value={settings?.incomeStartMonth}
            birthDate={birthDate}
          />
        </div>
      </fieldset>
    </>
  );
}

function AllocationFields({
  account,
  saved,
  portfolio,
}: {
  account: FiAccountCoverage;
  saved: FiPlanSettings | null;
  portfolio: boolean;
}) {
  const [included, setIncluded] = useState(account.included);
  const [manual, setManual] = useState(
    Boolean(saved?.manualAllocations[account.id]) || !account.confirmationKey,
  );
  const mix = saved?.manualAllocations[account.id];
  return (
    <div className="fi-account-allocation">
      <label className="goals-account-option">
        <input
          type="checkbox"
          name="includedAccountIds"
          value={account.id}
          checked={included}
          onChange={(e) => setIncluded(e.target.checked)}
        />
        {account.name}
      </label>
      {included && (
        <>
          <p className="fi-chart-note">
            Statement: {account.statementMonth?.slice(0, 7) ?? "missing"}
            {account.cashOnly ? (
              " · 100% cash allocation"
            ) : (
              <>
                {" "}
                · Snapshot: {account.snapshotDate ?? "missing"}
                {" · "}Quotes: {account.quoteDate ?? "unknown"} · Cash:{" "}
                {account.cashDate ?? "unknown"}.
              </>
            )}
          </p>
          {portfolio && !account.cashOnly && (
            <>
              <label className="fi-input-label">
                Allocation source for {account.name}
                <select
                  className="daybreak-field"
                  name={`allocationMode:${account.id}`}
                  value={manual ? "manual" : "snapshot"}
                  onChange={(e) => setManual(e.target.value === "manual")}
                >
                  <option value="snapshot" disabled={!account.confirmationKey}>
                    Holdings snapshot
                  </option>
                  <option value="manual">Explicit account allocation</option>
                </select>
              </label>
              {manual ? (
                <div className="fi-input-grid">
                  {FI_ASSETS.map((asset) => (
                    <label key={asset} className="fi-input-label">
                      {labels[asset]} (%)
                      <input
                        className="daybreak-field"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        required
                        name={`allocation:${account.id}:${asset}`}
                        defaultValue={(mix?.weights[asset] ?? 0) * 100}
                      />
                    </label>
                  ))}
                  <label className="fi-input-label">
                    Weighted annual fund expenses (%)
                    <input
                      className="daybreak-field"
                      type="number"
                      min="0"
                      max="10"
                      step="0.001"
                      required
                      name={`expense:${account.id}`}
                      defaultValue={(mix?.expenseRate ?? 0) * 100}
                    />
                  </label>
                </div>
              ) : (
                <label className="goals-account-option">
                  <input
                    type="checkbox"
                    name={`confirmSnapshot:${account.id}`}
                    value={account.confirmationKey ?? ""}
                    defaultChecked={
                      saved?.confirmedSnapshots[account.id] === account.confirmationKey
                    }
                    required
                  />
                  <span>
                    Use this snapshot
                    {account.warnings.length ? `: ${account.warnings.join("; ")}` : ""}
                  </span>
                </label>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function TimingField({
  label,
  monthName,
  ageName,
  value,
  birthDate,
}: {
  label: string;
  monthName: string;
  ageName: string;
  value?: string | null;
  birthDate?: string | null;
}) {
  const id = useId();
  const [editing, setEditing] = useState(!value);
  return (
    <div className="fi-input-label">
      {value && !editing ? (
        <>
          <span>
            {label} · {value.slice(0, 7)}
          </span>
          <input type="hidden" name={monthName} value={value} />
          <button className="daybreak-button" type="button" onClick={() => setEditing(true)}>
            Change {label.toLowerCase()}
          </button>
        </>
      ) : (
        <>
          <label htmlFor={id}>
            {label}
            {birthDate ? " age" : " month"}
          </label>
          <input
            className="daybreak-field"
            id={id}
            name={birthDate ? ageName : monthName}
            type={birthDate ? "number" : "month"}
            min={birthDate ? "0" : undefined}
            max={birthDate ? "120" : undefined}
            step={birthDate ? "1" : undefined}
          />
        </>
      )}
    </div>
  );
}
