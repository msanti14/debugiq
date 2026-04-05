"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { AnalysisResult, Severity } from "@debugiq/shared-types";
import type { PaginatedResults } from "@debugiq/shared-types";
import { SeverityBadge, Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

interface ResultsTableProps {
  data: PaginatedResults<AnalysisResult> | null;
  loading: boolean;
  error: string | null;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Returns the highest severity among findings, or null if no findings. */
function worstSeverity(result: AnalysisResult): Severity | null {
  const order: Severity[] = ["critical", "high", "medium", "low", "info"];
  for (const s of order) {
    if (result.findings.some((f) => f.severity === s)) return s;
  }
  return null;
}

export function ResultsTable({
  data,
  loading,
  error,
  page,
  pageSize,
  onPageChange,
}: ResultsTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-700/50 bg-red-900/20 p-6 text-center text-red-300">
        <p className="font-medium">Failed to load results</p>
        <p className="mt-1 text-sm text-red-400/80">{error}</p>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="rounded-lg border border-white/5 bg-surface-1 p-12 text-center">
        <p className="text-muted">No analysis results yet.</p>
        <p className="mt-1 text-sm text-muted/70">
          Run an analysis from the VS Code extension to see results here.
        </p>
      </div>
    );
  }

  const totalPages = Math.ceil(data.total / pageSize);

  return (
    <div className="flex flex-col gap-4">
      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-white/5">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 bg-surface-1 text-left text-xs uppercase tracking-wider text-muted">
              <th className="px-4 py-3">Analyzed</th>
              <th className="px-4 py-3">Language</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">Findings</th>
              <th className="px-4 py-3">Worst</th>
              <th className="px-4 py-3">Model</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3 sr-only">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((result) => {
              const worst = worstSeverity(result);
              const isOpen = expanded === result.result_id;

              return (
                <React.Fragment key={result.result_id}>
                  <tr
                    className="cursor-pointer border-b border-white/5 transition-colors hover:bg-surface-1"
                    onClick={() =>
                      setExpanded(isOpen ? null : result.result_id)
                    }
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted">
                      {formatDate(result.analyzed_at)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          result.language === "python" ? "blue" : "purple"
                        }
                      >
                        {result.language}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={result.mode === "learn" ? "green" : "default"}
                      >
                        {result.mode}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {result.findings_count}
                      {result.demo_mode && (
                        <span className="ml-1.5 text-xs text-muted">(demo)</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {worst ? (
                        <SeverityBadge severity={worst} />
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">
                      {result.model_used}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted">
                      {result.duration_ms != null
                        ? `${result.duration_ms}ms`
                        : "—"}
                    </td>
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link
                        href={`/results/${result.result_id}`}
                        className="text-xs font-medium text-brand-500 hover:underline"
                        aria-label={`View details for result ${result.result_id}`}
                      >
                        View →
                      </Link>
                    </td>
                  </tr>

                  {/* Expanded findings panel */}
                  {isOpen && result.findings.length > 0 && (
                    <tr key={`${result.result_id}-findings`}>
                      <td colSpan={8} className="bg-surface-0 px-6 py-4">
                        <div className="flex flex-col gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                            Findings
                          </p>
                          {result.findings.map((f) => (
                            <div
                              key={f.id}
                              className="rounded-lg border border-white/5 bg-surface-1 px-4 py-3"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="font-medium text-white">
                                    {f.title}
                                  </p>
                                  <p className="mt-0.5 text-xs text-muted">
                                    Lines {f.line_start}–{f.line_end} •{" "}
                                    {f.category}
                                  </p>
                                </div>
                                <SeverityBadge severity={f.severity} />
                              </div>
                              {(f.fix_hint || f.explanation) && (
                                <p className="mt-2 text-xs text-muted/80">
                                  {f.fix_hint ?? f.explanation}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>
            Page {page} of {totalPages} — {data.total} total
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              ← Prev
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Next →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
