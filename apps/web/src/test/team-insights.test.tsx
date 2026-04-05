/**
 * apps/web/src/test/team-insights.test.tsx
 * Tests for TeamInsightsPanel: loading, data, empty, and error states.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import * as teamsApi from "@/lib/api/teams";
import { TeamInsightsPanel } from "@/components/teams/TeamInsightsPanel";
import { ApiError } from "@/lib/api/client";
import type { TeamInsights } from "@debugiq/shared-types";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const MOCK_INSIGHTS: TeamInsights = {
  daily_results_last_14d: [
    { date: "2026-03-23", count: 0 },
    { date: "2026-03-24", count: 1 },
    { date: "2026-03-25", count: 0 },
    { date: "2026-03-26", count: 2 },
    { date: "2026-03-27", count: 0 },
    { date: "2026-03-28", count: 0 },
    { date: "2026-03-29", count: 0 },
    { date: "2026-03-30", count: 1 },
    { date: "2026-03-31", count: 0 },
    { date: "2026-04-01", count: 3 },
    { date: "2026-04-02", count: 0 },
    { date: "2026-04-03", count: 1 },
    { date: "2026-04-04", count: 0 },
    { date: "2026-04-05", count: 2 },
  ],
  top_bug_categories_last_30d: [
    { category: "sql_injection", count: 5 },
    { category: "xss", count: 3 },
  ],
  top_signatures_last_30d: [
    { signature_hash: "abc123def456789012345678", count: 4 },
    { signature_hash: "xyz789abc123456789012345", count: 2 },
  ],
  member_activity_last_30d: [
    { user_id: "user-uuid-1", display_name: "Alice", results_count: 8 },
    { user_id: "user-uuid-2", display_name: null, results_count: 3 },
  ],
};

const EMPTY_INSIGHTS: TeamInsights = {
  daily_results_last_14d: Array.from({ length: 14 }, (_, i) => ({
    date: `2026-03-${String(i + 1).padStart(2, "0")}`,
    count: 0,
  })),
  top_bug_categories_last_30d: [],
  top_signatures_last_30d: [],
  member_activity_last_30d: [],
};

beforeEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("TeamInsightsPanel — loading", () => {
  it("renders the loading indicator while the request is in-flight", () => {
    vi.spyOn(teamsApi, "getTeamInsights").mockReturnValue(
      new Promise(() => {}), // never resolves
    );
    render(<TeamInsightsPanel teamId="team-abc" />);
    expect(screen.getByTestId("insights-loading")).toBeTruthy();
  });
});

describe("TeamInsightsPanel — success", () => {
  it("renders the insights panel", async () => {
    vi.spyOn(teamsApi, "getTeamInsights").mockResolvedValue(MOCK_INSIGHTS);

    await act(async () => {
      render(<TeamInsightsPanel teamId="team-abc" />);
    });

    expect(screen.getByTestId("insights-panel")).toBeTruthy();
  });

  it("renders the trend bars when there is activity", async () => {
    vi.spyOn(teamsApi, "getTeamInsights").mockResolvedValue(MOCK_INSIGHTS);

    await act(async () => {
      render(<TeamInsightsPanel teamId="team-abc" />);
    });

    expect(screen.getByTestId("trend-bars")).toBeTruthy();
  });

  it("displays category labels and member names", async () => {
    vi.spyOn(teamsApi, "getTeamInsights").mockResolvedValue(MOCK_INSIGHTS);

    await act(async () => {
      render(<TeamInsightsPanel teamId="team-abc" />);
    });

    // Category with underscores rendered as spaces
    expect(screen.getByText("sql injection")).toBeTruthy();
    expect(screen.getByText("xss")).toBeTruthy();

    // Member with display_name shows name; null falls back to user_id prefix
    expect(screen.getByText("Alice")).toBeTruthy();
    // user-uuid-2 has no display_name → shows "user-uui…" (first 8 chars)
    expect(screen.getByText("user-uui…")).toBeTruthy();
  });
});

describe("TeamInsightsPanel — empty state", () => {
  it("renders empty-state messages when all lists are empty", async () => {
    vi.spyOn(teamsApi, "getTeamInsights").mockResolvedValue(EMPTY_INSIGHTS);

    await act(async () => {
      render(<TeamInsightsPanel teamId="team-abc" />);
    });

    expect(screen.getByText("No activity in the last 30 days.")).toBeTruthy();
    expect(screen.getByText("No findings recorded yet.")).toBeTruthy();
    expect(screen.getByText("No signatures recorded yet.")).toBeTruthy();
    expect(screen.getByText("No member activity in the last 30 days.")).toBeTruthy();
  });
});

describe("TeamInsightsPanel — error", () => {
  it("renders the error state when the request fails with ApiError", async () => {
    vi.spyOn(teamsApi, "getTeamInsights").mockRejectedValue(
      new ApiError(403, "not_a_member"),
    );

    await act(async () => {
      render(<TeamInsightsPanel teamId="team-abc" />);
    });

    expect(screen.getByTestId("insights-error")).toBeTruthy();
    expect(screen.getByText("not_a_member")).toBeTruthy();
  });

  it("shows generic message for unknown errors", async () => {
    vi.spyOn(teamsApi, "getTeamInsights").mockRejectedValue(
      new Error("network failure"),
    );

    await act(async () => {
      render(<TeamInsightsPanel teamId="team-abc" />);
    });

    expect(screen.getByTestId("insights-error")).toBeTruthy();
    expect(screen.getByText("Failed to load team insights.")).toBeTruthy();
  });
});

describe("TeamInsightsPanel — retry", () => {
  it("renders a 'Try again' button in the error state", async () => {
    vi.spyOn(teamsApi, "getTeamInsights").mockRejectedValue(
      new ApiError(500, "server_error"),
    );

    await act(async () => {
      render(<TeamInsightsPanel teamId="team-abc" />);
    });

    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("calls getTeamInsights again when retry button is clicked", async () => {
    const spy = vi
      .spyOn(teamsApi, "getTeamInsights")
      .mockRejectedValue(new ApiError(500, "server_error"));

    await act(async () => {
      render(<TeamInsightsPanel teamId="team-abc" />);
    });

    expect(spy).toHaveBeenCalledTimes(1);

    const retryBtn = screen.getByRole("button", { name: "Try again" });
    await act(async () => {
      await userEvent.click(retryBtn);
    });

    expect(spy).toHaveBeenCalledTimes(2);
  });
});
