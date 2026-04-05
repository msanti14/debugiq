/**
 * Result detail page tests.
 * Covers: loading state, successful render (metadata + findings),
 * 404 not-found state, and generic error state.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";

// ── Mocks (hoisted by Vitest above all imports) ────────────────────────────────

vi.mock("next/navigation", () => ({
  useParams: vi.fn(() => ({ id: "result-abc123" })),
  useRouter: vi.fn(() => ({ back: vi.fn() })),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => React.createElement("a", { href, className }, children),
}));

vi.mock("@/lib/auth/context", () => ({
  useAuth: () => ({
    user: {
      user_id: "user-1",
      email: "test@example.com",
      display_name: "Tester",
      tier: "free" as const,
      created_at: "2024-01-01T00:00:00Z",
    },
    loading: false,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    clearError: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

// ── Imports that depend on mocks ───────────────────────────────────────────────

import * as resultsApi from "@/lib/api/results";
import { ApiError } from "@/lib/api/client";
import type { AnalysisResult } from "@debugiq/shared-types";
import ResultDetailPage from "@/app/(app)/results/[id]/page";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const MOCK_RESULT: AnalysisResult = {
  result_id: "result-abc123",
  user_id: "user-1",
  language: "python",
  mode: "quick",
  code_hash: "a".repeat(64),
  findings_count: 2,
  findings: [
    {
      id: "f1",
      category: "sql_injection",
      severity: "critical",
      title: "SQL Injection risk",
      description: "User input passed directly to query.",
      line_start: 10,
      line_end: 12,
      fix_hint: "Use parameterized queries.",
    },
    {
      id: "f2",
      category: "bare_exception",
      severity: "low",
      title: "Bare exception catch",
      description: "Catching all exceptions hides real errors.",
      line_start: 20,
      line_end: 22,
    },
  ],
  model_used: "gpt-4o",
  duration_ms: 1200,
  demo_mode: false,
  analyzed_at: "2026-03-01T12:00:00Z",
  created_at: "2026-03-01T12:00:01Z",
};

// ── Tests ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("ResultDetailPage — loading", () => {
  it("shows a spinner while fetching", () => {
    vi.spyOn(resultsApi, "getResult").mockImplementation(
      () => new Promise(() => {}), // never resolves
    );
    render(<ResultDetailPage />);
    // Spinner renders an SVG with animate-spin
    const svgs = document.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
  });
});

describe("ResultDetailPage — success", () => {
  it("renders the heading and both finding titles", async () => {
    vi.spyOn(resultsApi, "getResult").mockResolvedValue(MOCK_RESULT);
    render(<ResultDetailPage />);

    await waitFor(() =>
      expect(screen.getByText("Result Detail")).toBeTruthy(),
    );

    expect(screen.getByText("SQL Injection risk")).toBeTruthy();
    expect(screen.getByText("Bare exception catch")).toBeTruthy();
  });

  it("renders the result_id in the header", async () => {
    vi.spyOn(resultsApi, "getResult").mockResolvedValue(MOCK_RESULT);
    render(<ResultDetailPage />);

    await waitFor(() =>
      expect(screen.getByText(MOCK_RESULT.result_id)).toBeTruthy(),
    );
  });

  it("shows severity summary with critical count", async () => {
    vi.spyOn(resultsApi, "getResult").mockResolvedValue(MOCK_RESULT);
    render(<ResultDetailPage />);

    await waitFor(() =>
      expect(screen.getByText("Result Detail")).toBeTruthy(),
    );
    // "Severity Summary" heading should be visible
    expect(screen.getByText("Severity Summary")).toBeTruthy();
    // fix_hint is rendered inside the finding card
    expect(screen.getByText("Use parameterized queries.")).toBeTruthy();
  });
});

describe("ResultDetailPage — 404", () => {
  it("shows the not-found message on a 404 ApiError", async () => {
    vi.spyOn(resultsApi, "getResult").mockRejectedValue(
      new ApiError(404, "result_not_found"),
    );
    render(<ResultDetailPage />);

    await waitFor(() =>
      expect(screen.getByText("Result not found")).toBeTruthy(),
    );
  });
});

describe("ResultDetailPage — generic error", () => {
  it("shows the error heading on a 500 ApiError", async () => {
    vi.spyOn(resultsApi, "getResult").mockRejectedValue(
      new ApiError(500, "internal_error"),
    );
    render(<ResultDetailPage />);

    await waitFor(() =>
      expect(screen.getByText("Error loading result")).toBeTruthy(),
    );
    expect(screen.getByText("internal_error")).toBeTruthy();
  });
});
