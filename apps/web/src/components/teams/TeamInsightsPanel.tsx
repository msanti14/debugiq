"use client";
/**
 * apps/web/src/components/teams/TeamInsightsPanel.tsx
 *
 * Renders team insights: activity trend, top categories, top signatures,
 * and member activity ranking. Supports configurable time window (days)
 * and top-N limit via pill selectors.
 *
 * Fetched from GET /v0/teams/{teamId}/analytics/insights.
 */

import { useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import type { TeamInsights } from "@debugiq/shared-types";
import { getTeamInsights } from "@/lib/api/teams";
import { ApiError } from "@/lib/api/client";
import { postAnalyticsEvent } from "@/lib/api/analytics";
import { Button } from "@/components/ui/Button";

// ── Types ───────────────────────────────────────────────────────────────────────

type DaysOption = 7 | 14 | 30 | 90;
type TopNOption = 5 | 10 | 20 | 50;

const DAYS_OPTIONS: DaysOption[] = [7, 14, 30, 90];
const TOP_N_OPTIONS: TopNOption[] = [5, 10, 20, 50];

// ── Sub-components ─────────────────────────────────────────────────────────────

function InsightSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-white/5 bg-surface-1 px-5 py-4">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </div>
  );
}

function EmptyNote({ message }: { message: string }) {
  return (
    <p className="text-xs italic text-muted/70">{message}</p>
  );
}

function PillSelector<T extends number>({
  options,
  value,
  onChange,
  label,
  format,
  disabled = false,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  format: (v: T) => string;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          disabled={disabled}
          aria-pressed={opt === value}
          className={[
            "rounded px-2 py-0.5 text-xs font-medium transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
            "disabled:cursor-not-allowed disabled:opacity-50",
            opt === value
              ? "bg-indigo-600 text-white"
              : "bg-white/5 text-muted hover:bg-white/10",
          ].join(" ")}
        >
          {format(opt)}
        </button>
      ))}
    </div>
  );
}

// ── Loading skeleton ────────────────────────────────────────────────────────────

// Fixed bar heights for the trend skeleton (avoids non-deterministic Math.random).
const SKELETON_BAR_HEIGHTS = [30, 60, 20, 75, 45, 55, 15, 90, 35, 70, 40, 65, 25, 50];

function InsightsSkeleton() {
  return (
    <div
      data-testid="insights-loading"
      className="flex flex-col gap-4"
      aria-busy="true"
      aria-label="Loading insights…"
    >
      {/* Controls row skeleton */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-6 w-9 animate-pulse rounded bg-surface-2" />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-6 w-7 animate-pulse rounded bg-surface-2" />
          ))}
        </div>
      </div>

      {/* Activity trend section skeleton */}
      <div className="rounded-lg border border-white/5 bg-surface-1 px-5 py-4">
        <div className="mb-3 h-3 w-40 animate-pulse rounded bg-surface-2" />
        <div className="flex items-end gap-[3px]" style={{ height: "48px" }}>
          {SKELETON_BAR_HEIGHTS.map((h, i) => (
            <div key={i} className="flex flex-1 items-end" style={{ height: "100%" }}>
              <div
                className="w-full animate-pulse rounded-sm bg-surface-2"
                style={{ height: `${h}%` }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Two-column section skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-lg border border-white/5 bg-surface-1 px-5 py-4">
            <div className="mb-3 h-3 w-36 animate-pulse rounded bg-surface-2" />
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((j) => (
                <div key={j} className="flex items-center justify-between">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-surface-2" />
                  <div className="h-4 w-8 animate-pulse rounded bg-surface-2" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Member activity section skeleton */}
      <div className="rounded-lg border border-white/5 bg-surface-1 px-5 py-4">
        <div className="mb-3 h-3 w-36 animate-pulse rounded bg-surface-2" />
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 w-4 animate-pulse rounded bg-surface-2" />
              <div className="h-4 flex-1 animate-pulse rounded bg-surface-2" />
              <div className="h-4 w-8 animate-pulse rounded bg-surface-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────────

interface Props {
  teamId: string;
}

export function TeamInsightsPanel({ teamId }: Props) {
  const [days, setDays] = useState<DaysOption>(30);
  const [topN, setTopN] = useState<TopNOption>(10);
  const [data, setData] = useState<TeamInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const retry = useCallback(() => setRetryKey((k) => k + 1), []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setData(null);
    getTeamInsights(teamId, { days, top_n: topN })
      .then(setData)
      .catch((err) => {
        setError(
          err instanceof ApiError ? err.detail : "Failed to load team insights.",
        );
      })
      .finally(() => setLoading(false));
  }, [teamId, days, topN, retryKey]);

  if (loading) {
    return <InsightsSkeleton />;
  }

  if (error) {
    return (
      <div
        data-testid="insights-error"
        role="alert"
        className="rounded-lg border border-red-700/50 bg-red-900/20 p-6 text-center"
      >
        <p className="font-medium text-red-300">Failed to load team insights</p>
        <p className="mt-1 text-sm text-red-400/80">{error}</p>
        <Button variant="secondary" size="sm" className="mt-4" onClick={retry}>
          Try again
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const allZero = data.daily_results_last_14d.every((d) => d.count === 0);
  const maxDay = Math.max(...data.daily_results_last_14d.map((d) => d.count), 1);

  return (
    <div data-testid="insights-panel" className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <PillSelector<DaysOption>
          options={DAYS_OPTIONS}
          value={days}
          onChange={(v) => {
            setDays(v);
            postAnalyticsEvent("team_insights_selector_changed", { days: v, top_n: topN });
          }}
          label="Time range"
          format={(v) => `${v}d`}
        />
        <PillSelector<TopNOption>
          options={TOP_N_OPTIONS}
          value={topN}
          onChange={(v) => {
            setTopN(v);
            postAnalyticsEvent("team_insights_selector_changed", { days, top_n: v });
          }}
          label="Top N"
          format={(v) => String(v)}
        />
      </div>

      {/* Activity trend */}
      <InsightSection title={`${days}-day activity trend`}>
        {allZero ? (
          <EmptyNote message={`No activity in the last ${days} days.`} />
        ) : (
          <div
            data-testid="trend-bars"
            className="flex items-end gap-[3px]"
            style={{ height: "48px" }}
          >
            {data.daily_results_last_14d.map(({ date, count }) => (
              <div
                key={date}
                className="flex flex-1 flex-col items-center justify-end"
                style={{ height: "100%" }}
                title={`${date}: ${count}`}
              >
                <div
                  className="w-full rounded-sm bg-indigo-500"
                  style={{
                    height: count === 0 ? "2px" : `${Math.round((count / maxDay) * 100)}%`,
                    opacity: count === 0 ? 0.2 : 1,
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </InsightSection>

      {/* Top bug categories + top signatures */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <InsightSection title={`Top bug categories (${days}d)`}>
          {data.top_bug_categories_last_30d.length === 0 ? (
            <EmptyNote message="No findings recorded yet." />
          ) : (
            <ul className="flex flex-col gap-2">
              {data.top_bug_categories_last_30d.map(({ category, count }) => (
                <li key={category} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-white">
                    {category.replace(/_/g, " ")}
                  </span>
                  <span className="tabular-nums text-muted">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </InsightSection>

        <InsightSection title={`Top signatures (${days}d)`}>
          {data.top_signatures_last_30d.length === 0 ? (
            <EmptyNote message="No signatures recorded yet." />
          ) : (
            <ul className="flex flex-col gap-2">
              {data.top_signatures_last_30d.map(({ signature_hash, count }) => (
                <li
                  key={signature_hash}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="font-mono text-xs text-white">
                    {signature_hash.slice(0, 12)}&hellip;
                  </span>
                  <span className="tabular-nums text-muted">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </InsightSection>
      </div>

      {/* Member activity ranking */}
      <InsightSection title={`Member activity (${days}d)`}>
        {data.member_activity_last_30d.length === 0 ? (
          <EmptyNote message={`No member activity in the last ${days} days.`} />
        ) : (
          <ol className="flex flex-col gap-2">
            {data.member_activity_last_30d.map(({ user_id, display_name, results_count }, idx) => (
              <li key={user_id} className="flex items-center gap-3 text-sm">
                <span className="w-4 text-right tabular-nums text-muted">{idx + 1}.</span>
                <span className="flex-1 truncate text-white">
                  {display_name ?? `${user_id.slice(0, 8)}…`}
                </span>
                <span className="tabular-nums text-muted">{results_count}</span>
              </li>
            ))}
          </ol>
        )}
      </InsightSection>
    </div>
  );
}
