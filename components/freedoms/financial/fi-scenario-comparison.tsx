"use client";

import type { FiScenarioComparisonProps } from "./types";
import { fiScenarioMarkerPath, formatFiMonth } from "./fi-chart-model";
import { FiProjectionChart } from "./fi-projection-chart";

export function FiScenarioComparison({ scenarios, stress, chart }: FiScenarioComparisonProps) {
  const base = scenarios.find((scenario) => scenario.kind === "base");
  if (!base?.plan) return null;
  const comparisons = scenarios.flatMap((scenario) =>
    scenario.plan
      ? [
          {
            kind: scenario.kind,
            title: scenario.title,
            series: scenario.plan.series,
            fiMonth: scenario.plan.fiMonth,
            depletionMonth: scenario.plan.depletionMonth,
            firstShortfallMonth: scenario.plan.firstShortfallMonth,
          },
        ]
      : [],
  );

  return (
    <div className="fi-scenarios">
      <dl className="fi-scenario-options" aria-label="Return scenarios">
        {scenarios.map((scenario) => (
          <div key={scenario.kind}>
            <dt>
              {scenario.plan && (
                <svg viewBox="0 0 32 10" width="32" height="10" aria-hidden>
                  <path d="M1 5H31" className={`fi-projected-line fi-line-${scenario.kind}`} />
                  <path
                    d={fiScenarioMarkerPath(scenario.kind, 16, 5, 3)}
                    className={`fi-scenario-marker fi-marker-${scenario.kind}`}
                  />
                </svg>
              )}
              {scenario.title}
            </dt>
            <dd>
              <strong>
                {scenario.realReturn === null
                  ? "Unavailable"
                  : `${(scenario.realReturn * 100).toFixed(1)}% real / yr`}
              </strong>
            </dd>
            <dd className="fi-scenario-date">
              {!scenario.plan
                ? "Complete allocation to project"
                : scenario.plan.monthsToFi === 0
                  ? "FI reached"
                  : scenario.plan.fiMonth
                    ? `FI · ${formatFiMonth(scenario.plan.fiMonth, chart.birthDate)}`
                    : "FI not reached by plan end"}
            </dd>
            {scenario.plan && (
              <dd className="fi-scenario-date">
                {scenario.plan.firstShortfallMonth
                  ? `First unfunded spending · ${formatFiMonth(scenario.plan.firstShortfallMonth, chart.birthDate)}`
                  : scenario.plan.retirementMonth
                    ? "No unfunded spending in this horizon"
                    : "Accumulation only"}
              </dd>
            )}
          </div>
        ))}
      </dl>
      <FiProjectionChart
        {...chart}
        planSeries={base.plan.series}
        comparisonSeries={comparisons}
        fiNumber={base.plan.fiNumber}
        fiMonth={base.plan.fiMonth}
        retirementMonth={base.plan.retirementMonth}
        ariaLabel="Investment projections by return scenario"
      />
      {stress && (
        <details className="goals-assumptions fi-stress">
          <summary>Sequence-risk stress tests</summary>
          <p className="fi-chart-note">
            Hypothetical one-year nominal shock: equities −35%, bonds −10%, cash 0%. Base returns in
            other months, with the same cash flows and fees. Not a probability forecast.
          </p>
          {stress.unavailable ? (
            <p>{stress.unavailable}</p>
          ) : (
            <div className="daybreak-table">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Shock timing</th>
                    <th scope="col">Ending balance</th>
                    <th scope="col">First unfunded spending</th>
                    <th scope="col">Cumulative shortfall</th>
                  </tr>
                </thead>
                <tbody>
                  {stress.results.map(({ title, shockMonth, plan }) => (
                    <tr key={title}>
                      <th scope="row">
                        {title} · {formatFiMonth(shockMonth, chart.birthDate)}
                      </th>
                      <td>{formatMoney(plan.series.at(-1)!.balance, chart.currency)}</td>
                      <td>
                        {plan.firstShortfallMonth
                          ? formatFiMonth(plan.firstShortfallMonth, chart.birthDate)
                          : "None by plan end"}
                      </td>
                      <td>{formatMoney(plan.cumulativeShortfall ?? 0, chart.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </details>
      )}
    </div>
  );
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
