/**
 * apps/web/src/lib/api/results.ts
 * Results endpoint wrappers.
 */

import type { AnalysisResult, PaginatedResults, SaveResultRequest, SaveResultResponse } from "@debugiq/shared-types";
import { apiFetch } from "./client";

export interface ListResultsParams {
  page?: number;
  page_size?: number;
  language?: string;
  mode?: string;
  team_id?: string;
}

export function listResults(params: ListResultsParams = {}): Promise<PaginatedResults<AnalysisResult>> {
  const qs = new URLSearchParams();
  if (params.page != null) qs.set("page", String(params.page));
  if (params.page_size != null) qs.set("page_size", String(params.page_size));
  if (params.language) qs.set("language", params.language);
  if (params.mode) qs.set("mode", params.mode);
  if (params.team_id) qs.set("team_id", params.team_id);
  const query = qs.toString();
  return apiFetch<PaginatedResults<AnalysisResult>>(`/v0/results${query ? `?${query}` : ""}`);
}

export function getResult(id: string): Promise<AnalysisResult> {
  return apiFetch<AnalysisResult>(`/v0/results/${id}`);
}

export function saveResult(body: SaveResultRequest): Promise<SaveResultResponse> {
  return apiFetch<SaveResultResponse>("/v0/results", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
