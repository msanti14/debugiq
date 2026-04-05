/**
 * apps/web/src/lib/api/teams.ts
 * Teams endpoint wrappers.
 */

import type { TeamResponse, CreateTeamRequest, TeamMemberResponse, AddMemberRequest, TeamAnalyticsSummary } from "@debugiq/shared-types";
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

export function getTeamAnalyticsSummary(teamId: string): Promise<TeamAnalyticsSummary> {
  return apiFetch<TeamAnalyticsSummary>(`/v0/teams/${teamId}/analytics/summary`);
}
