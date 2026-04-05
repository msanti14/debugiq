"use client";

import { useState, useEffect, useCallback } from "react";
import type { PaginatedResults, AnalysisResult } from "@debugiq/shared-types";
import { listResults, type ListResultsParams } from "@/lib/api/results";
import { ApiError } from "@/lib/api/client";
import { ResultsTable } from "@/components/results/ResultsTable";
import { ResultFilters } from "@/components/results/ResultFilters";
import { useAuth } from "@/lib/auth/context";
import { useWorkspace } from "@/lib/workspace/context";
import { TeamAnalyticsPanel } from "@/components/teams/TeamAnalyticsPanel";

const PAGE_SIZE = 20;

export default function DashboardPage() {
  const { user } = useAuth();
  const { scope } = useWorkspace();

  const [params, setParams] = useState<ListResultsParams>({
    page: 1,
    page_size: PAGE_SIZE,
  });
  const [data, setData] = useState<PaginatedResults<AnalysisResult> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = useCallback(async (p: ListResultsParams) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listResults(p);
      setData(result);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.detail : "Unexpected error loading results.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch when scope or params change.
  useEffect(() => {
    const teamId = scope !== "personal" ? scope.id : undefined;
    fetchResults({ ...params, team_id: teamId });
  }, [params, scope, fetchResults]);

  const scopeLabel =
    scope === "personal"
      ? user?.display_name
        ? `Welcome back, ${user.display_name}.`
        : "Your analysis history."
      : `Team: ${scope.name}`;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
        <p className="mt-0.5 text-sm text-muted">{scopeLabel}</p>
      </div>

      {/* Summary stats */}
      {data && !loading && (
        <DashboardStats data={data} />
      )}

      {/* Team analytics panel (team scope only) */}
      {scope !== "personal" && (
        <TeamAnalyticsPanel teamId={scope.id} />
      )}

      {/* Filters */}
      <ResultFilters
        params={params}
        onChange={(updated) => setParams({ ...updated, page: 1, page_size: PAGE_SIZE })}
      />

      {/* Results table */}
      <ResultsTable
        data={data}
        loading={loading}
        error={error}
        page={params.page ?? 1}
        pageSize={PAGE_SIZE}
        onPageChange={(page) => setParams((p) => ({ ...p, page }))}
      />
    </div>
  );
}

// ── Inline stats component ─────────────────────────────────────────────────────

function DashboardStats({ data }: { data: PaginatedResults<AnalysisResult> }) {
  const items = data.items;

  const totalFindings = items.reduce((acc, r) => acc + r.findings_count, 0);
  const criticalCount = items.reduce(
    (acc, r) => acc + r.findings.filter((f) => f.severity === "critical").length,
    0,
  );
  const avgDuration =
    items.filter((r) => r.duration_ms != null).length > 0
      ? Math.round(
          items.reduce((acc, r) => acc + (r.duration_ms ?? 0), 0) /
            items.filter((r) => r.duration_ms != null).length,
        )
      : null;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <StatCard label="Total analyses" value={String(data.total)} hint="all time" />
      <StatCard label="Findings" value={String(totalFindings)} hint="this page" />
      <StatCard
        label="Critical"
        value={String(criticalCount)}
        hint="this page"
        highlight={criticalCount > 0}
      />
      <StatCard
        label="Avg duration"
        value={avgDuration != null ? `${avgDuration}ms` : "—"}
        hint="this page"
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  highlight = false,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-surface-1 px-5 py-4">
      <p className="text-xs text-muted">
        {label}
        {hint && <span className="ml-1 text-muted/60">({hint})</span>}
      </p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums ${
          highlight ? "text-red-400" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
