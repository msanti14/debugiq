/**
 * Navigation wiring tests.
 * Covers: Sidebar renders a Settings link; ResultsTable renders per-row View links.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/dashboard"),
  useParams: vi.fn(() => ({})),
  useRouter: vi.fn(() => ({ back: vi.fn() })),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
    "aria-label": ariaLabel,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    "aria-label"?: string;
  }) =>
    React.createElement("a", { href, className, "aria-label": ariaLabel }, children),
}));

vi.mock("@/lib/auth/context", () => ({
  useAuth: () => ({
    user: {
      user_id: "user-1",
      email: "nav@example.com",
      display_name: "Nav User",
      tier: "free" as const,
      created_at: "2025-01-01T00:00:00Z",
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

vi.mock("@/lib/workspace/context", () => ({
  useWorkspace: () => ({
    scope: "personal" as const,
    teams: [],
    teamsLoading: false,
    setScope: vi.fn(),
  }),
}));

// ── Imports ────────────────────────────────────────────────────────────────────

import { Sidebar } from "@/components/layout/Sidebar";
import { ResultsTable } from "@/components/results/ResultsTable";
import type { PaginatedResults, AnalysisResult } from "@debugiq/shared-types";

// ── Tests ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("Sidebar — Settings link", () => {
  it("renders a link to /settings labeled 'Settings'", () => {
    render(<Sidebar />);
    const link = screen.getByRole("link", { name: /settings/i });
    expect(link).toBeTruthy();
    expect((link as HTMLAnchorElement).href).toContain("/settings");
  });
});

describe("ResultsTable — View links", () => {
  const makeResult = (id: string): AnalysisResult => ({
    result_id: id,
    user_id: "user-1",
    language: "python",
    mode: "quick",
    code_hash: "b".repeat(64),
    findings_count: 0,
    findings: [],
    model_used: "gpt-4o",
    duration_ms: 500,
    demo_mode: false,
    analyzed_at: "2026-01-01T10:00:00Z",
    created_at: "2026-01-01T10:00:01Z",
  });

  const mockData: PaginatedResults<AnalysisResult> = {
    items: [makeResult("r1"), makeResult("r2")],
    total: 2,
    page: 1,
    page_size: 20,
  };

  it("renders a View link for each row pointing to /results/{id}", () => {
    render(
      <ResultsTable
        data={mockData}
        loading={false}
        error={null}
        page={1}
        pageSize={20}
        onPageChange={vi.fn()}
      />,
    );

    const viewLinks = screen.getAllByText("View →");
    expect(viewLinks).toHaveLength(2);

    const r1Link = viewLinks[0] as HTMLAnchorElement;
    expect(r1Link.href).toContain("/results/r1");

    const r2Link = viewLinks[1] as HTMLAnchorElement;
    expect(r2Link.href).toContain("/results/r2");
  });
});
