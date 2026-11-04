"use client";

import { useCallback, useId, useState } from "react";
import type { PointerEvent } from "react";
import type { MonthlyBalancePoint } from "@/lib/freedoms/types";
import type { FiProjectionChartProps } from "./types";
import {
  buildFiChartModel,
  fiMonthIndex,
  fiMonthString,
  formatFiMonth,
  nearestFiSample,
  smoothFiPath,
  fiScenarioMarkerPath,
} from "./fi-chart-model";
import { formatProjectionDate } from "@/lib/profile/birth-date";

export function FiProjectionChart({
  planSeries,
  comparisonSeries = [],
  actualSeries = [],
  fiNumber,
  fiMonth,
  todayMonth,
  currency,
  birthDate,
  milestones = [],
  ariaLabel,
  retirementMonth,
}: FiProjectionChartProps) {
  const id = useId();
  const [nearTerm, setNearTerm] = useState(false);
  const [inspectedMonth, setInspectedMonth] = useState<string | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [width, setWidth] = useState(640);
  const measure = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const resize = () => setWidth(Math.max(1, node.clientWidth));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const model = buildFiChartModel(
    { planSeries, actualSeries, fiNumber, comparisonSeries },
    nearTerm,
  );
  if (!model) return null;

  const { start, end, samples, anchor, yMin, yMax } = model;
  const formatDate = (date: string) => formatFiMonth(date, birthDate);
  const height = 240;
  const top = 16;
  const bottom = height - 12;
  const xFraction = (month: number) => (month - start) / (end - start);
  const x = (month: string) => 8 + xFraction(fiMonthIndex(month)!) * (width - 16);
  const y = (balance: number) => bottom - ((balance - yMin) / (yMax - yMin)) * (bottom - top);
  const path = (series: MonthlyBalancePoint[]) =>
    smoothFiPath(series.map((p) => ({ x: x(p.month), y: y(p.balance) })));
  const compact = (value: number) =>
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  const money = (value: number) =>
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  const index = nearestFiSample(model, fiMonthIndex(inspectedMonth ?? "") ?? anchor);
  const inspected = samples[index]!;
  const goal = milestones.find((item) => item.id === selectedGoal);
  const goalMonth = goal?.targetDate ? fiMonthIndex(goal.targetDate) : null;
  const visibleGoal = goalMonth !== null && goalMonth >= start && goalMonth <= end;
  const fiIndex = fiMonth ? fiMonthIndex(fiMonth) : null;
  const visibleFi = fiIndex !== null && fiIndex >= start && fiIndex <= end;
  const today = fiMonthIndex(todayMonth);
  const retirementIndex = retirementMonth ? fiMonthIndex(retirementMonth) : null;
  const tickCount = Math.min(
    end - start < 24 || width < 360 ? 2 : width < 600 ? 3 : 5,
    end - start + 1,
  );
  const ticks = Array.from({ length: tickCount }, (_, i) =>
    Math.round(start + (i / (tickCount - 1)) * (end - start)),
  );
  const datedMonths = [
    ...new Set(
      milestones.flatMap((item) => {
        const month = item.targetDate ? fiMonthIndex(item.targetDate) : null;
        return month !== null && month >= start && month <= end ? [month] : [];
      }),
    ),
  ];
  const onPointer = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const fraction = Math.max(
      0,
      Math.min(1, (event.clientX - bounds.left - 8) / (bounds.width - 16)),
    );
    setInspectedMonth(samples[nearestFiSample(model, start + fraction * (end - start))]!.month);
  };
  const inspectedComparisons = model.comparisons.flatMap((item) => {
    const point = item.series.find((point) => point.month === inspected.month);
    return point
      ? [
          {
            ...item,
            balance: point.balance,
            shortfall: point.shortfall,
            cumulativeShortfall: point.cumulativeShortfall,
          },
        ]
      : [];
  });
  const sampleText =
    !inspected.recorded && inspectedComparisons.length
      ? `${formatDate(inspected.month)} · ${retirementMonth && inspected.month >= retirementMonth ? "Retirement" : "Accumulation"}${inspected.spending !== undefined ? ` · Spending ${money(inspected.spending)}, income ${money(inspected.income ?? 0)}` : ""} · ${inspectedComparisons.map((item) => `${item.title} ${money(item.balance)}${item.shortfall !== undefined ? `, unfunded ${money(item.shortfall)}, cumulative ${money(item.cumulativeShortfall ?? 0)}` : ""}`).join(" · ")}`
      : `${formatDate(inspected.month)} · ${inspected.recorded ? "Recorded" : "Projected"} invested balance · ${money(inspected.balance)}`;

  return (
    <figure className="fi-chart" aria-label={ariaLabel ?? "Investment path and goal timeline"}>
      <figcaption className="fi-chart-heading">
        <div className="fi-chart-legend">
          {model.actual.length > 0 && (
            <span>
              <i className="fi-legend-recorded" aria-hidden />
              Recorded
            </span>
          )}
          {model.comparisons.length === 0 && (
            <span>
              <i className="fi-legend-projected" aria-hidden />
              Projected
            </span>
          )}
          <span>
            <i className="fi-legend-threshold" aria-hidden />
            FI threshold
          </span>
        </div>
        <div className="fi-chart-views" role="group" aria-label="Projection view">
          <button type="button" aria-pressed={!nearTerm} onClick={() => setNearTerm(false)}>
            Full plan
          </button>
          <button type="button" aria-pressed={nearTerm} onClick={() => setNearTerm(true)}>
            {fiMonthIndex(planSeries.at(-1)!.month)! - anchor < 60 ? "Near term" : "Next 5 years"}
          </button>
        </div>
      </figcaption>

      <p className="fi-chart-threshold">
        <span>
          FI threshold <strong>{money(fiNumber)}</strong>
        </span>
        {model.comparisons.length === 0 && (
          <span>
            {fiMonth
              ? `${fiIndex === anchor ? "Met at start" : "Model reaches target"} · ${formatDate(fiMonth)}`
              : "Not reached by plan end"}
          </span>
        )}
      </p>

      <div className="fi-chart-grid">
        <div className="fi-chart-y-axis" aria-hidden>
          {model.yTicks.map((tick) => (
            <span key={tick} style={{ top: y(tick) }}>
              {compact(tick)}
            </span>
          ))}
        </div>
        <div
          className="fi-chart-plot"
          ref={measure}
          role="slider"
          tabIndex={0}
          aria-label="Inspect investment balance"
          aria-valuemin={0}
          aria-valuemax={samples.length - 1}
          aria-valuenow={index}
          aria-valuetext={sampleText}
          aria-describedby={`${id}-help`}
          aria-disabled={samples.length < 2}
          onKeyDown={(event) => {
            let next = index;
            switch (event.key) {
              case "ArrowRight":
              case "ArrowUp":
                next++;
                break;
              case "ArrowLeft":
              case "ArrowDown":
                next--;
                break;
              case "Home":
                next = 0;
                break;
              case "End":
                next = samples.length - 1;
                break;
              case "PageUp":
                next += 12;
                break;
              case "PageDown":
                next -= 12;
                break;
              default:
                return;
            }
            event.preventDefault();
            setInspectedMonth(samples[Math.max(0, Math.min(samples.length - 1, next))]!.month);
          }}
          onPointerDown={onPointer}
          onPointerMove={(event) => {
            if (event.pointerType === "mouse") onPointer(event);
          }}
        >
          <svg
            width="100%"
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={
              model.comparisons.length
                ? "Recorded balances and return scenarios on a shared scale"
                : "Recorded balances and projected invested assets"
            }
          >
            {model.yTicks.map((tick) => (
              <line
                key={tick}
                x1={8}
                x2={width - 8}
                y1={y(tick)}
                y2={y(tick)}
                className="fi-gridline"
              />
            ))}
            <line
              x1={8}
              x2={width - 8}
              y1={y(fiNumber)}
              y2={y(fiNumber)}
              className="fi-threshold-line"
            />
            {retirementMonth &&
              retirementIndex !== null &&
              retirementIndex >= start &&
              retirementIndex <= end && (
                <g className="fi-retirement-marker">
                  <line
                    x1={x(retirementMonth)}
                    x2={x(retirementMonth)}
                    y1={top}
                    y2={bottom}
                    className="fi-goal-guide"
                  />
                  <text
                    x={x(retirementMonth)}
                    y={top + 12}
                    textAnchor={retirementIndex > (start + end) / 2 ? "end" : "start"}
                  >
                    Retirement
                  </text>
                  <title>{`Retirement · ${formatDate(retirementMonth)}`}</title>
                </g>
              )}
            {today !== null && today >= start && today <= end && (
              <line
                x1={x(todayMonth)}
                x2={x(todayMonth)}
                y1={top}
                y2={bottom}
                className="fi-today-line"
              >
                <title>{`Current month · ${formatDate(todayMonth)}`}</title>
              </line>
            )}
            {model.comparisons.length ? (
              model.comparisons.map((item) => (
                <g key={item.kind}>
                  <path
                    key={item.kind}
                    d={path(item.series)}
                    className={`fi-projected-line fi-scenario-line fi-line-${item.kind}`}
                  >
                    <title>{item.title}</title>
                  </path>
                  {item.series.at(-1) && (
                    <path
                      d={fiScenarioMarkerPath(
                        item.kind,
                        x(item.series.at(-1)!.month),
                        y(item.series.at(-1)!.balance),
                      )}
                      className={`fi-scenario-endpoint fi-scenario-marker fi-marker-${item.kind}`}
                    />
                  )}
                </g>
              ))
            ) : (
              <path d={path(model.plan)} className="fi-projected-line" />
            )}
            <path d={path(model.actual)} className="fi-recorded-line" />
            {model.actual.map((point) => (
              <circle
                key={point.month}
                cx={x(point.month)}
                cy={y(point.balance)}
                r={2.5}
                className="fi-recorded-point"
              />
            ))}
            {model.comparisons.map((item) =>
              item.fiMonth &&
              fiMonthIndex(item.fiMonth)! >= start &&
              fiMonthIndex(item.fiMonth)! <= end ? (
                <path
                  key={item.kind}
                  d={`M${x(item.fiMonth)} ${y(fiNumber) - 6}l6 6-6 6-6-6Z`}
                  className={`fi-crossing-point fi-crossing-${item.kind}`}
                >
                  <title>{`${item.title} · FI ${formatDate(item.fiMonth)}`}</title>
                </path>
              ) : null,
            )}
            {model.comparisons.map((item) =>
              item.depletionMonth &&
              fiMonthIndex(item.depletionMonth)! >= start &&
              fiMonthIndex(item.depletionMonth)! <= end ? (
                <g
                  key={`depletion-${item.kind}`}
                  className={`fi-depletion-marker fi-marker-${item.kind}`}
                >
                  <path d={`M${x(item.depletionMonth) - 5} ${y(0) - 5}l10 10m0 -10l-10 10`} />
                  <title>{`${item.title} depleted · ${formatDate(item.depletionMonth)}`}</title>
                </g>
              ) : null,
            )}
            {model.comparisons.length === 0 && visibleFi && fiMonth && (
              <path
                d={`M${x(fiMonth)} ${y(fiNumber) - 6}l6 6-6 6-6-6Z`}
                className="fi-crossing-point"
              >
                <title>{`FI threshold · ${formatDate(fiMonth)}`}</title>
              </path>
            )}
            {visibleGoal && (
              <line
                x1={8 + xFraction(goalMonth!) * (width - 16)}
                x2={8 + xFraction(goalMonth!) * (width - 16)}
                y1={top}
                y2={bottom}
                className="fi-goal-guide"
              />
            )}
            <line
              x1={x(inspected.month)}
              x2={x(inspected.month)}
              y1={top}
              y2={bottom}
              className="fi-inspection-line"
            />
            {!inspected.recorded && inspectedComparisons.length ? (
              inspectedComparisons.map((item) => (
                <circle
                  key={item.kind}
                  cx={x(inspected.month)}
                  cy={y(item.balance)}
                  r={4}
                  className={`fi-inspection-point fi-inspection-${item.kind}`}
                />
              ))
            ) : (
              <circle
                cx={x(inspected.month)}
                cy={y(inspected.balance)}
                r={5}
                className="fi-inspection-point"
              />
            )}
          </svg>
        </div>
        <span className="fi-chart-axis-title">Goals</span>
        <div className="fi-chart-rail" aria-hidden>
          {datedMonths.map((month) => (
            <i
              key={month}
              className={goalMonth === month ? "is-selected" : ""}
              style={{ left: `calc(8px + ${xFraction(month)} * (100% - 16px))` }}
            />
          ))}
          {model.comparisons.length === 0 && visibleFi && (
            <b
              className="fi-rail-fi"
              style={{ left: `calc(8px + ${xFraction(fiIndex!)} * (100% - 16px))` }}
            />
          )}
        </div>
        <span />
        <div className="fi-chart-x-axis" aria-hidden>
          {ticks.map((tick, i) => (
            <span
              key={tick}
              style={{
                left: `${xFraction(tick) * 100}%`,
                transform: `translateX(${i === 0 ? 0 : i === ticks.length - 1 ? -100 : -50}%)`,
              }}
            >
              {birthDate
                ? formatProjectionDate(fiMonthString(tick), birthDate, true)
                : tickCount === 2
                  ? formatFiMonth(fiMonthString(tick))
                  : fiMonthString(tick).slice(0, 4)}
            </span>
          ))}
        </div>
      </div>

      <div className="fi-chart-inspector">
        <output id={`${id}-value`} aria-live="off">
          {sampleText}
        </output>
        <p id={`${id}-help`} className="sr-only">
          Hover or tap the chart to inspect. Focus the chart and use arrow keys to move between
          available months.
        </p>
      </div>

      {milestones.length > 0 ? (
        <div className="fi-chart-milestones">
          <h4>Goals along the way</h4>
          <ul>
            {milestones.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  aria-pressed={selectedGoal === item.id}
                  onClick={() => {
                    setSelectedGoal(selectedGoal === item.id ? null : item.id);
                    if (item.targetDate && fiMonthIndex(item.targetDate) !== null) {
                      setInspectedMonth(item.targetDate);
                      const month = fiMonthIndex(item.targetDate)!;
                      if (month < start || month > end) setNearTerm(false);
                    }
                  }}
                >
                  <span>{item.title}</span>
                  <small>
                    {item.targetDate && fiMonthIndex(item.targetDate) !== null
                      ? `Target · ${formatDate(item.targetDate)}`
                      : "No target date"}
                    {item.status === "achieved" ? " · Achieved" : ""}
                  </small>
                </button>
              </li>
            ))}
          </ul>
          {goal && (
            <p className="fi-chart-goal-detail" role="status">
              <strong>{goal.title}</strong>
              {goal.targetAmount !== null
                ? ` · Target ${money(goal.targetAmount)}`
                : " · No target amount"}
              {goal.targetDate && goalMonth !== null
                ? ` · Target date ${birthDate ? formatDate(goal.targetDate) : new Date(`${goal.targetDate}T00:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`
                : " · No target date"}
              {goalMonth !== null && !visibleGoal ? " · Outside chart range" : ""}
            </p>
          )}
        </div>
      ) : null}

      <p className="fi-chart-note">
        Plan through {formatFiMonth(planSeries.at(-1)!.month, birthDate)}.
        {retirementMonth
          ? ` Retirement · ${formatDate(retirementMonth)}. Cross marks show depletion.`
          : ""}
      </p>
    </figure>
  );
}
