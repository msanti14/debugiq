/**
 * apps/web/src/test/team-insights-v3.test.tsx
 * Tests for TeamInsightsPanel v3: range selector and top-N selector interactions.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import * as teamsApi from "@/lib/api/teams";
import { TeamInsightsPanel } from "@/components/teams/TeamInsightsPanel";
import type { TeamInsights } from "@debugiq/shared-types";

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeInsights(days: number): TeamInsights {
  return {
    daily_results_last_14d: Array.from({ length: days }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, "0")}`,
      count: 0,
    })),
    top_bug_categories_last_30d: [],
    top_signatures_last_30d: [],
    member_activity_last_30d: [],
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// ── Range selector ─────────────────────────────────────────────────────────────

describe("TeamInsightsPanel v3 — range selector", () => {
  it("renders all four range pill buttons (7d, 14d, 30d, 90d)", async () => {
    vi.spyOn(teamsApi, "getTeamInsights").mockResolvedValue(makeInsights(30));

    await act(async () => {
      render(<TeamInsightsPanel teamId="team-abc" />);
    });

    expect(screen.getByRole("button", { name: "7d" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "14d" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "30d" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "90d" })).toBeTruthy();
  });

  it("calls getTeamInsights with { days: 7 } when 7d is clicked", async () => {
    const spy = vi
      .spyOn(teamsApi, "getTeamInsights")
      .mockResolvedValue(makeInsights(30));

    await act(async () => {
      render(<TeamInsightsPanel teamId="team-abc" />);
    });

    const btn7d = screen.getByRole("button", { name: "7d" });

    await act(async () => {
      await userEvent.click(btn7d);
    });

    expect(spy).toHaveBeenCalledWith("team-abc", expect.objectContaining({ days: 7 }));
  });

  it("calls getTeamInsights with { days: 90 } when 90d is clicked", async () => {
    const spy = vi
      .spyOn(teamsApi, "getTeamInsights")
      .mockResolvedValue(makeInsights(30));

    await act(async () => {
      render(<TeamInsightsPanel teamId="team-abc" />);
    });

    const btn90d = screen.getByRole("button", { name: "90d" });

    await act(async () => {
      await userEvent.click(btn90d);
    });

    expect(spy).toHaveBeenCalledWith("team-abc", expect.objectContaining({ days: 90 }));
  });
});

// ── Top N selector ─────────────────────────────────────────────────────────────

describe("TeamInsightsPanel v3 — top N selector", () => {
  it("renders all four top-N pill buttons (5, 10, 20, 50)", async () => {
    vi.spyOn(teamsApi, "getTeamInsights").mockResolvedValue(makeInsights(30));

    await act(async () => {
      render(<TeamInsightsPanel teamId="team-abc" />);
    });

    expect(screen.getByRole("button", { name: "5" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "10" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "20" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "50" })).toBeTruthy();
  });

  it("calls getTeamInsights with { top_n: 50 } when 50 is clicked", async () => {
    const spy = vi
      .spyOn(teamsApi, "getTeamInsights")
      .mockResolvedValue(makeInsights(30));

    await act(async () => {
      render(<TeamInsightsPanel teamId="team-abc" />);
    });

    const btn50 = screen.getByRole("button", { name: "50" });

    await act(async () => {
      await userEvent.click(btn50);
    });

    expect(spy).toHaveBeenCalledWith("team-abc", expect.objectContaining({ top_n: 50 }));
  });

  it("calls getTeamInsights with { top_n: 5 } when 5 is clicked", async () => {
    const spy = vi
      .spyOn(teamsApi, "getTeamInsights")
      .mockResolvedValue(makeInsights(30));

    await act(async () => {
      render(<TeamInsightsPanel teamId="team-abc" />);
    });

    const btn5 = screen.getByRole("button", { name: "5" });

    await act(async () => {
      await userEvent.click(btn5);
    });

    expect(spy).toHaveBeenCalledWith("team-abc", expect.objectContaining({ top_n: 5 }));
  });
});

// ── Refetch on param change ────────────────────────────────────────────────────

describe("TeamInsightsPanel v3 — refetch on param change", () => {
  it("refetches (calls getTeamInsights twice) when range selector changes", async () => {
    const spy = vi
      .spyOn(teamsApi, "getTeamInsights")
      .mockResolvedValue(makeInsights(30));

    await act(async () => {
      render(<TeamInsightsPanel teamId="team-abc" />);
    });

    // Initial call on mount
    expect(spy).toHaveBeenCalledTimes(1);

    const btn7d = screen.getByRole("button", { name: "7d" });

    await act(async () => {
      await userEvent.click(btn7d);
    });

    // Second call after selector change
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("refetches (calls getTeamInsights twice) when top-N selector changes", async () => {
    const spy = vi
      .spyOn(teamsApi, "getTeamInsights")
      .mockResolvedValue(makeInsights(30));

    await act(async () => {
      render(<TeamInsightsPanel teamId="team-abc" />);
    });

    expect(spy).toHaveBeenCalledTimes(1);

    const btn5 = screen.getByRole("button", { name: "5" });

    await act(async () => {
      await userEvent.click(btn5);
    });

    expect(spy).toHaveBeenCalledTimes(2);
  });
});
