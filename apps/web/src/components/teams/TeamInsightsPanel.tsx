"use client";
/**
 * apps/web/src/components/teams/TeamInsightsPanel.tsx
 *
 * Renders team insights: 14-day trend, top categories, top signatures,
 * and member activity ranking. Fetched from
 * GET /v0/teams/{teamId}/analytics/insights.
 */

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { TeamInsights } from "@debugiq/shared-types";
import { getTeamInsights } from "@/lib/api/teams";
import { ApiError } from "@/lib/api/client";

// ── Sub-components ─────────────────────────────────────────────────────────────

function InsightSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-white/5 bg-surface-1 px-5 py-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">{title}</p>
      {children}
    </div>
  );
}

function EmptyNote({ message }: { message: string }) {
  return <p className="text-xs text-muted">{message}</p>;
}

// ── Main component ──────────────────────────────────────────────────────────────

interface Props {
  teamId: string;
}

export function TeamInsightsPanel({ teamId }: Props) {
  const [data, setData] = useState<TeamInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setData(null);
    getTeamInsights(teamId)
      .then(setData)
      .catch((err) => {
        setError(
          err instanceof ApiError ? err.detail : "Failed to load team insights.",
        );
      })
      .finally(() => setLoading(false));
  }, [teamId]);

  if (loading) {
    return (
      <div data-testid="insights-loading" className="text-sm text-muted">
        Loading insights…
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="insights-error" className="text-sm text-red-400">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const allZero = data.daily_results_last_14d.every((d) => d.count === 0);
  const maxDay = Math.max(...data.daily_results_last_14d.map((d) => d.count), 1);

  return (
    <div data-testid="insights-panel" className="flex flex-col gap-4">
      {/* 14-day activity trend */}
      <InsightSection title="14-day activity trend">
        {allZero ? (
          <EmptyNote message="No activity in the last 14 days." />
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
        <InsightSection title="Top bug categories (30d)">
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

        <InsightSection title="Top signatures (30d)">
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
      <InsightSection title="Member activity (30d)">
        {data.member_activity_last_30d.length === 0 ? (
          <EmptyNote message="No member activity in the last 30 days." />
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
