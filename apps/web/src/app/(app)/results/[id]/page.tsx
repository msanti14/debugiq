"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { AnalysisResult, Finding, Severity } from "@debugiq/shared-types";
import { getResult } from "@/lib/api/results";
import { ApiError } from "@/lib/api/client";
import { SeverityBadge, Badge, categoryLabel } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

export default function ResultDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id ?? "";

  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    setLoading(true);
    setError(null);
    setNotFound(false);
    getResult(id)
      .then((data) => {
        setResult(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(
            err instanceof ApiError ? err.detail : "Failed to load result.",
          );
        }
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <p className="text-lg font-semibold text-white">Result not found</p>
        <p className="text-sm text-muted">
          This analysis doesn&apos;t exist or belongs to another account.
        </p>
        <Button variant="secondary" onClick={() => router.back()}>
          ← Back
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <p className="text-lg font-semibold text-white">Error loading result</p>
        <p className="text-sm text-red-400">{error}</p>
        <Button variant="secondary" onClick={() => router.back()}>
          ← Back
        </Button>
      </div>
    );
  }

  if (!result) return null;

  const severitySummary = countSeverities(result);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Breadcrumb */}
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-muted transition-colors hover:text-white"
        >
          ← Dashboard
        </Link>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Result Detail</h1>
        <p className="mt-0.5 font-mono text-xs text-muted">{result.result_id}</p>
      </div>

      {/* Metadata card */}
      <div className="rounded-lg border border-white/5 bg-surface-1 p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted">
          Metadata
        </h2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
          <MetaItem label="Analyzed">{formatDate(result.analyzed_at)}</MetaItem>
          <MetaItem label="Language">
            <Badge variant={result.language === "python" ? "blue" : "purple"}>
              {result.language}
            </Badge>
          </MetaItem>
          <MetaItem label="Mode">
            <Badge variant={result.mode === "learn" ? "green" : "default"}>
              {result.mode}
            </Badge>
          </MetaItem>
          <MetaItem label="Model">
            <span className="font-mono text-xs text-white">
              {result.model_used}
            </span>
          </MetaItem>
          <MetaItem label="Duration">
            {result.duration_ms != null ? `${result.duration_ms} ms` : "—"}
          </MetaItem>
          {result.demo_mode && (
            <MetaItem label="Demo">
              <Badge variant="default">demo</Badge>
            </MetaItem>
          )}
        </dl>
      </div>

      {/* Severity summary */}
      {result.findings_count > 0 && (
        <div className="rounded-lg border border-white/5 bg-surface-1 p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted">
            Severity Summary
          </h2>
          <div className="flex flex-wrap gap-3">
            {(
              ["critical", "high", "medium", "low", "info"] as Severity[]
            ).map((s) =>
              severitySummary[s] > 0 ? (
                <div key={s} className="flex items-center gap-1.5">
                  <SeverityBadge severity={s} />
                  <span className="tabular-nums text-sm text-white">
                    {severitySummary[s]}
                  </span>
                </div>
              ) : null,
            )}
          </div>
        </div>
      )}

      {/* Findings list */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
          Findings ({result.findings_count})
        </h2>
        {result.findings.length === 0 ? (
          <div className="rounded-lg border border-white/5 bg-surface-1 p-8 text-center text-sm text-muted">
            No findings for this analysis.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {result.findings.map((f) => (
              <FindingCard key={f.id} finding={f} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function countSeverities(
  result: AnalysisResult,
): Record<Severity, number> {
  const counts: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const f of result.findings) {
    counts[f.severity]++;
  }
  return counts;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetaItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-white">{children}</dd>
    </div>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  return (
    <article className="rounded-lg border border-white/5 bg-surface-1 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium text-white">{finding.title}</p>
          <p className="mt-0.5 text-xs text-muted">
            Lines {finding.line_start}–{finding.line_end} &middot;{" "}
            {categoryLabel[finding.category]}
          </p>
        </div>
        <SeverityBadge severity={finding.severity} />
      </div>
      <p className="mt-2 text-sm text-muted/80">{finding.description}</p>
      {(finding.fix_hint ?? finding.explanation) && (
        <div className="mt-3 rounded border border-white/5 bg-surface-0 px-3 py-2 text-xs text-muted">
          {finding.fix_hint ?? finding.explanation}
        </div>
      )}
    </article>
  );
}
