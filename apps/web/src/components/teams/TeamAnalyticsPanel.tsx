"use client";
/**
 * apps/web/src/components/teams/TeamAnalyticsPanel.tsx
 *
 * Renders team-level analytics summary fetched from
 * GET /v0/teams/{teamId}/analytics/summary.
 */

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { TeamAnalyticsSummary } from "@debugiq/shared-types";
import { getTeamAnalyticsSummary } from "@/lib/api/teams";
import { ApiError } from "@/lib/api/client";

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
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
        {title}
      </p>
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

// ── Main panel ─────────────────────────────────────────────────────────────────

interface Props {
  teamId: string;
}

export function TeamAnalyticsPanel({ teamId }: Props) {
  const [data, setData] = useState<TeamAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, [teamId]);

  if (loading) {
    return (
      <div data-testid="analytics-loading" className="text-sm text-muted">
        Loading analytics…
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="analytics-error" className="text-sm text-red-400">
        {error}
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
