/**
 * TeamAnalyticsPanel tests.
 * Covers: loading state, successful render, and error state.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import * as teamsApi from "@/lib/api/teams";
import { TeamAnalyticsPanel } from "@/components/teams/TeamAnalyticsPanel";
import { ApiError } from "@/lib/api/client";
import type { TeamAnalyticsSummary } from "@debugiq/shared-types";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const MOCK_SUMMARY: TeamAnalyticsSummary = {
  total_results: 10,
  results_last_7d: 3,
  results_last_30d: 7,
  severity_counts: { critical: 1, high: 2, medium: 3, low: 1, info: 0 },
  mode_counts: { quick: 6, learn: 4 },
  language_counts: { python: 8, typescript: 2 },
  active_members_last_30d: 2,
};

beforeEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("TeamAnalyticsPanel — loading", () => {
  it("renders the loading indicator while the request is in-flight", () => {
    vi.spyOn(teamsApi, "getTeamAnalyticsSummary").mockReturnValue(
      new Promise(() => {}), // never resolves
    );
    render(<TeamAnalyticsPanel teamId="team-abc" />);
    expect(screen.getByTestId("analytics-loading")).toBeTruthy();
  });
});

describe("TeamAnalyticsPanel — success", () => {
  it("renders the analytics panel with summary data", async () => {
    vi.spyOn(teamsApi, "getTeamAnalyticsSummary").mockResolvedValue(MOCK_SUMMARY);

    await act(async () => {
      render(<TeamAnalyticsPanel teamId="team-abc" />);
    });

    expect(screen.getByTestId("analytics-panel")).toBeTruthy();
  });

  it("displays correct headline counters", async () => {
    vi.spyOn(teamsApi, "getTeamAnalyticsSummary").mockResolvedValue(MOCK_SUMMARY);

    await act(async () => {
      render(<TeamAnalyticsPanel teamId="team-abc" />);
    });

    expect(screen.getByText("10")).toBeTruthy(); // total_results
    // Use the labeled stat card to avoid ambiguity with severity counts
    const last7dCard = screen.getByText("Last 7 days").closest("div")!;
    expect(within(last7dCard).getByText("3")).toBeTruthy(); // results_last_7d
    expect(screen.getByText("7")).toBeTruthy();  // results_last_30d
    const activeMembersCard = screen.getByText("Active members (last 30d)").closest("div")!;
    expect(within(activeMembersCard).getByText("2")).toBeTruthy(); // active_members_last_30d
  });
});

describe("TeamAnalyticsPanel — error", () => {
  it("renders the error state when the request fails", async () => {
    vi.spyOn(teamsApi, "getTeamAnalyticsSummary").mockRejectedValue(
      new ApiError(403, "not_a_member"),
    );

    await act(async () => {
      render(<TeamAnalyticsPanel teamId="team-abc" />);
    });

    expect(screen.getByTestId("analytics-error")).toBeTruthy();
    expect(screen.getByText("not_a_member")).toBeTruthy();
  });

  it("shows generic message for non-ApiError failures", async () => {
    vi.spyOn(teamsApi, "getTeamAnalyticsSummary").mockRejectedValue(
      new Error("network failure"),
    );

    await act(async () => {
      render(<TeamAnalyticsPanel teamId="team-abc" />);
    });

    expect(screen.getByTestId("analytics-error")).toBeTruthy();
    expect(screen.getByText("Failed to load team analytics.")).toBeTruthy();
  });
});

describe("TeamAnalyticsPanel — retry", () => {
  it("renders a 'Try again' button in the error state", async () => {
    vi.spyOn(teamsApi, "getTeamAnalyticsSummary").mockRejectedValue(
      new ApiError(500, "server_error"),
    );

    await act(async () => {
      render(<TeamAnalyticsPanel teamId="team-abc" />);
    });

    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("calls getTeamAnalyticsSummary again when retry button is clicked", async () => {
    const spy = vi
      .spyOn(teamsApi, "getTeamAnalyticsSummary")
      .mockRejectedValue(new ApiError(500, "server_error"));

    await act(async () => {
      render(<TeamAnalyticsPanel teamId="team-abc" />);
    });

    expect(spy).toHaveBeenCalledTimes(1);

    const retryBtn = screen.getByRole("button", { name: "Try again" });
    await act(async () => {
      await userEvent.click(retryBtn);
    });

    expect(spy).toHaveBeenCalledTimes(2);
  });
});
