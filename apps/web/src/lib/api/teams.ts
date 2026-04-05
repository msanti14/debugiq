/**
 * apps/web/src/lib/api/teams.ts
 * Teams endpoint wrappers.
 */

import type { TeamResponse, CreateTeamRequest, TeamMemberResponse, AddMemberRequest, TeamAnalyticsSummary, TeamInsights } from "@debugiq/shared-types";
import { apiFetch } from "./client";

export function listTeams(): Promise<TeamResponse[]> {
  return apiFetch<TeamResponse[]>("/v0/teams");
}

export function getTeam(teamId: string): Promise<TeamResponse> {
  return apiFetch<TeamResponse>(`/v0/teams/${teamId}`);
}

export function createTeam(body: CreateTeamRequest): Promise<TeamResponse> {
  return apiFetch<TeamResponse>("/v0/teams", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function listTeamMembers(teamId: string): Promise<TeamMemberResponse[]> {
  return apiFetch<TeamMemberResponse[]>(`/v0/teams/${teamId}/members`);
}

export function addTeamMember(teamId: string, body: AddMemberRequest): Promise<TeamMemberResponse> {
  return apiFetch<TeamMemberResponse>(`/v0/teams/${teamId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function getTeamAnalyticsSummary(teamId: string, params?: { days?: number }): Promise<TeamAnalyticsSummary> {
  const qs = params?.days !== undefined ? `?days=${params.days}` : "";
  return apiFetch<TeamAnalyticsSummary>(`/v0/teams/${teamId}/analytics/summary${qs}`);
}

export function getTeamInsights(teamId: string, params?: { days?: number; top_n?: number }): Promise<TeamInsights> {
  const search = new URLSearchParams();
  if (params?.days !== undefined) search.set("days", String(params.days));
  if (params?.top_n !== undefined) search.set("top_n", String(params.top_n));
  const qs = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<TeamInsights>(`/v0/teams/${teamId}/analytics/insights${qs}`);
}
