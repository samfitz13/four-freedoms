"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { loadMoreTransactions } from "./cashflow-actions";
import { TransactionRow } from "./transaction-row";
import type { LedgerCursor, LedgerFilters, LedgerRow } from "@/lib/db/queries/types";
import type { PeerInfo } from "./types";

type Account = { id: string; name: string; currency: string; isArchived?: boolean };
type Category = { id: string; name: string; kind: string };

const inputBase =
  "daybreak-field min-h-11 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--glass-control)] px-3 text-sm focus:border-[color:var(--color-foreground)]";
const labelCls = "font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]";

const PRESETS = [
  { key: "all", label: "All" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
  { key: "ytd", label: "YTD" },
  { key: "custom", label: "Custom" },
] as const;
type PresetKey = (typeof PRESETS)[number]["key"];

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function isoYearStart(): string {
  return `${new Date().getFullYear()}-01-01`;
}

function presetToRange(preset: PresetKey): { from?: string; to?: string } {
  switch (preset) {
    case "7d":
      return { from: isoDaysAgo(7), to: isoToday() };
    case "30d":
      return { from: isoDaysAgo(30), to: isoToday() };
    case "90d":
      return { from: isoDaysAgo(90), to: isoToday() };
    case "ytd":
      return { from: isoYearStart(), to: isoToday() };
    default:
      return {};
  }
}

export function LedgerView({
  initial,
  accounts,
  categories,
}: {
  initial: { rows: LedgerRow[]; nextCursor: LedgerCursor | null; peers: Record<string, PeerInfo> };
  accounts: Account[];
  categories: Category[];
}) {
  const [rows, setRows] = useState<LedgerRow[]>(initial.rows);
  const [peers, setPeers] = useState<Record<string, PeerInfo>>(initial.peers);
  const [nextCursor, setNextCursor] = useState<LedgerCursor | null>(initial.nextCursor);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [accountId, setAccountId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [flow, setFlow] = useState<"" | "income" | "expense" | "transfer">("");
  const [preset, setPreset] = useState<PresetKey>("all");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce free-text search.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const filters = useMemo<LedgerFilters>(() => {
    const range =
      preset === "custom"
        ? { from: customFrom || undefined, to: customTo || undefined }
        : presetToRange(preset);
    return {
      q: debouncedQ.trim() || undefined,
      accountId: accountId || undefined,
      categoryId: categoryId || undefined,
      flow: flow || undefined,
      from: range.from,
      to: range.to,
    };
  }, [debouncedQ, accountId, categoryId, flow, preset, customFrom, customTo]);

  const filtersKey = JSON.stringify(filters);
  const isInitialMount = useRef(true);

  // Refetch from page 1 whenever filters change. Skip the very first run
  // since the server-rendered `initial` already matches empty filters.
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    startTransition(() => {
      loadMoreTransactions({ filters, cursor: null })
        .then((res) => {
          if (cancelled) return;
          setRows(res.rows);
          setPeers(res.peers);
          setNextCursor(res.nextCursor);
        })
        .catch((e) => {
          if (cancelled) return;
          setError(e instanceof Error ? e.message : "Failed to load");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  // Infinite-scroll sentinel.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!nextCursor) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries[0];
        if (!hit?.isIntersecting) return;
        if (loading) return;
        setLoading(true);
        setError(null);
        loadMoreTransactions({ filters, cursor: nextCursor })
          .then((res) => {
            setRows((prev) => prev.concat(res.rows));
            setPeers((prev) => ({ ...prev, ...res.peers }));
            setNextCursor(res.nextCursor);
          })
          .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
          .finally(() => setLoading(false));
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [nextCursor, loading, filters]);

  const hasFilter =
    debouncedQ.trim().length > 0 ||
    accountId !== "" ||
    categoryId !== "" ||
    flow !== "" ||
    preset !== "all";

  const reset = () => {
    setQ("");
    setDebouncedQ("");
    setAccountId("");
    setCategoryId("");
    setFlow("");
    setPreset("all");
    setCustomFrom("");
    setCustomTo("");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 border-y border-[color:var(--color-border)] py-3">
        <div className="grid gap-3 sm:grid-cols-12">
          <div className="flex flex-col gap-1 sm:col-span-5">
            <label className={labelCls} htmlFor="ledger-q">
              Search
            </label>
            <input
              id="ledger-q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Description…"
              className={inputBase}
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-3">
            <label className={labelCls} htmlFor="ledger-account">
              Account
            </label>
            <select
              id="ledger-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className={inputBase}
            >
              <option value="">All</option>
              {accounts
                .filter((a) => !a.isArchived)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className={labelCls} htmlFor="ledger-category">
              Category
            </label>
            <select
              id="ledger-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputBase}
            >
              <option value="">All</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className={labelCls} htmlFor="ledger-flow">
              Flow
            </label>
            <select
              id="ledger-flow"
              value={flow}
              onChange={(e) => setFlow(e.target.value as "" | "income" | "expense" | "transfer")}
              className={inputBase}
            >
              <option value="">All</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={labelCls}>Range</span>
          {PRESETS.map((p) => {
            const active = preset === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setPreset(p.key)}
                className={[
                  "rounded-[var(--radius-sm)] border px-2 py-1 font-sans text-xs tracking-normal",
                  active
                    ? "border-[color:var(--color-foreground)] bg-[color:var(--color-foreground)] text-[color:var(--color-paper)]"
                    : "border-[color:var(--color-border)] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]",
                ].join(" ")}
              >
                {p.label}
              </button>
            );
          })}
          {preset === "custom" ? (
            <>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="daybreak-field h-8 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--glass-control)] px-2 text-xs"
                aria-label="From"
              />
              <span className="font-sans text-xs text-[color:var(--color-ink-soft)]">→</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="daybreak-field h-8 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--glass-control)] px-2 text-xs"
                aria-label="To"
              />
            </>
          ) : null}
          {hasFilter ? (
            <button
              type="button"
              onClick={reset}
              className="daybreak-button ml-auto font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]"
            >
              Reset
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-[color:var(--color-accent-warning,#9a3412)]">{error}</p>
      ) : null}

      {rows.length === 0 && !loading ? (
        <p className="py-8 text-center text-sm text-[color:var(--color-ink-soft)]">
          No transactions match these filters.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-[color:var(--color-border)]">
          {rows.map((t) => {
            const peer = peers[t.id] ?? null;
            return (
              <TransactionRow
                key={t.id}
                tx={t}
                accounts={accounts}
                categories={categories}
                peer={peer}
              />
            );
          })}
        </ul>
      )}

      <div
        ref={sentinelRef}
        aria-live="polite"
        className="flex items-center justify-center py-4 font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]"
      >
        {loading
          ? "Loading…"
          : nextCursor
            ? "\u00A0"
            : rows.length > 0
              ? `End of ledger · ${rows.length} ${rows.length === 1 ? "row" : "rows"}`
              : "\u00A0"}
      </div>
    </div>
  );
}
