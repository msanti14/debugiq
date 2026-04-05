"use client";
/**
 * apps/web/src/components/teams/TeamAnalyticsPanel.tsx
 *
 * Renders team-level analytics summary fetched from
 * GET /v0/teams/{teamId}/analytics/summary.
 */

import { useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import type { TeamAnalyticsSummary } from "@debugiq/shared-types";
import { getTeamAnalyticsSummary } from "@/lib/api/teams";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-surface-1 px-5 py-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-white">{value}</p>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-surface-1 px-5 py-4">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
        {title}
      </h3>
      {children}
    </div>
  );
}

function CountGrid({
  entries,
}: {
  entries: { label: string; value: number }[];
}) {
  return (
    <dl
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${entries.length}, minmax(0, 1fr))` }}
    >
      {entries.map(({ label, value }) => (
        <div key={label} className="text-center">
          <dt className="text-xs capitalize text-muted">{label}</dt>
          <dd className="text-lg font-bold tabular-nums text-white">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ── Loading skeleton ────────────────────────────────────────────────────────────

function AnalyticsSkeleton() {
  return (
    <div
      data-testid="analytics-loading"
      className="flex flex-col gap-4"
      aria-busy="true"
      aria-label="Loading analytics…"
    >
      {/* Headline stat card skeletons */}
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg border border-white/5 bg-surface-1 px-5 py-4">
            <div className="h-3 w-24 animate-pulse rounded bg-surface-2" />
            <div className="mt-2 h-7 w-16 animate-pulse rounded bg-surface-2" />
          </div>
        ))}
      </div>

      {/* Severity section skeleton */}
      <div className="rounded-lg border border-white/5 bg-surface-1 px-5 py-4">
        <div className="mb-3 h-3 w-32 animate-pulse rounded bg-surface-2" />
        <div className="grid grid-cols-5 gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="h-3 w-10 animate-pulse rounded bg-surface-2" />
              <div className="h-5 w-8 animate-pulse rounded bg-surface-2" />
            </div>
          ))}
        </div>
      </div>

      {/* Mode + Language section skeleton */}
      <div className="grid grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-lg border border-white/5 bg-surface-1 px-5 py-4">
            <div className="mb-3 h-3 w-16 animate-pulse rounded bg-surface-2" />
            <div className="grid grid-cols-2 gap-2">
              {[0, 1].map((j) => (
                <div key={j} className="flex flex-col items-center gap-1">
                  <div className="h-3 w-12 animate-pulse rounded bg-surface-2" />
                  <div className="h-5 w-8 animate-pulse rounded bg-surface-2" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Active members skeleton */}
      <div className="rounded-lg border border-white/5 bg-surface-1 px-5 py-4">
        <div className="h-3 w-40 animate-pulse rounded bg-surface-2" />
        <div className="mt-2 h-7 w-8 animate-pulse rounded bg-surface-2" />
      </div>
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────

interface Props {
  teamId: string;
}

export function TeamAnalyticsPanel({ teamId }: Props) {
  const [data, setData] = useState<TeamAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const retry = useCallback(() => setRetryKey((k) => k + 1), []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setData(null);
    getTeamAnalyticsSummary(teamId)
      .then(setData)
      .catch((err) => {
        setError(
          err instanceof ApiError ? err.detail : "Failed to load team analytics.",
        );
      })
      .finally(() => setLoading(false));
  }, [teamId, retryKey]);

  if (loading) {
    return <AnalyticsSkeleton />;
  }

  if (error) {
    return (
      <div
        data-testid="analytics-error"
        role="alert"
        className="rounded-lg border border-red-700/50 bg-red-900/20 p-6 text-center"
      >
        <p className="font-medium text-red-300">Failed to load team analytics</p>
        <p className="mt-1 text-sm text-red-400/80">{error}</p>
        <Button variant="secondary" size="sm" className="mt-4" onClick={retry}>
          Try again
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const sevEntries = (
    ["critical", "high", "medium", "low", "info"] as const
  ).map((k) => ({ label: k, value: data.severity_counts[k] }));

  const modeEntries = (["quick", "learn"] as const).map((k) => ({
    label: k,
    value: data.mode_counts[k],
  }));

  const langEntries = (["python", "typescript"] as const).map((k) => ({
    label: k,
    value: data.language_counts[k],
  }));

  return (
    <div data-testid="analytics-panel" className="flex flex-col gap-4">
      {/* Headline counters */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total analyses" value={String(data.total_results)} />
        <StatCard label="Last 7 days" value={String(data.results_last_7d)} />
        <StatCard label="Last 30 days" value={String(data.results_last_30d)} />
      </div>

      {/* Severity */}
      <SectionCard title="Severity breakdown">
        <CountGrid entries={sevEntries} />
      </SectionCard>

      {/* Mode + Language */}
      <div className="grid grid-cols-2 gap-4">
        <SectionCard title="By mode">
          <CountGrid entries={modeEntries} />
        </SectionCard>
        <SectionCard title="By language">
          <CountGrid entries={langEntries} />
        </SectionCard>
      </div>

      {/* Active members */}
      <StatCard
        label="Active members (last 30d)"
        value={String(data.active_members_last_30d)}
      />
    </div>
  );
}
