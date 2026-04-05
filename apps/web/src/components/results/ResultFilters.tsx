"use client";

import React from "react";
import type { ListResultsParams } from "@/lib/api/results";

interface ResultFiltersProps {
  params: ListResultsParams;
  onChange: (updated: ListResultsParams) => void;
}

export function ResultFilters({ params, onChange }: ResultFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <select
        value={params.language ?? ""}
        onChange={(e) =>
          onChange({ ...params, language: e.target.value || undefined })
        }
        className="rounded-lg border border-white/10 bg-surface-1 px-3 py-1.5 text-sm text-white"
        aria-label="Filter by language"
      >
        <option value="">All languages</option>
        <option value="python">Python</option>
        <option value="typescript">TypeScript</option>
      </select>

      <select
        value={params.mode ?? ""}
        onChange={(e) =>
          onChange({ ...params, mode: e.target.value || undefined })
        }
        className="rounded-lg border border-white/10 bg-surface-1 px-3 py-1.5 text-sm text-white"
        aria-label="Filter by mode"
      >
        <option value="">All modes</option>
        <option value="quick">Quick</option>
        <option value="learn">Learn</option>
      </select>
    </div>
  );
}
