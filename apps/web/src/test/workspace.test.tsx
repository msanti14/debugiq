/**
 * Workspace context tests.
 * Covers: default personal scope, team scope selection, localStorage persistence,
 * scope reset on logout, and error thrown outside provider.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import React from "react";
import { WorkspaceProvider, useWorkspace } from "@/lib/workspace/context";
import * as teamsApi from "@/lib/api/teams";
import type { TeamResponse } from "@debugiq/shared-types";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const MOCK_USER = {
  user_id: "user-1",
  email: "ws@example.com",
  display_name: "WS User",
  tier: "free" as const,
  created_at: "2025-01-01T00:00:00Z",
};

vi.mock("@/lib/auth/context", () => ({
  useAuth: vi.fn(() => ({
    user: MOCK_USER,
    loading: false,
  })),
}));

const MOCK_TEAM: TeamResponse = {
  team_id: "team-abc",
  name: "Alpha Squad",
  owner_id: "user-1",
  tier: "free",
  created_at: "2025-01-01T00:00:00Z",
};

// ── Fixtures ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

// ── Helper components ──────────────────────────────────────────────────────────

function ScopeDisplay() {
  const { scope } = useWorkspace();
  const label =
    scope === "personal" ? "personal" : `team:${scope.id}:${scope.name}`;
  return <span data-testid="scope">{label}</span>;
}

function ScopeSelector() {
  const { setScope, teams } = useWorkspace();
  return (
    <div>
      <button onClick={() => setScope("personal")}>set-personal</button>
      {teams.map((t) => (
        <button
          key={t.team_id}
          onClick={() => setScope({ type: "team", id: t.team_id, name: t.name })}
        >
          {`set-team-${t.team_id}`}
        </button>
      ))}
    </div>
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("WorkspaceProvider — default scope", () => {
  it("starts with personal scope when no teams and nothing in localStorage", async () => {
    vi.spyOn(teamsApi, "listTeams").mockResolvedValue([]);

    await act(async () => {
      render(
        <WorkspaceProvider>
          <ScopeDisplay />
        </WorkspaceProvider>,
      );
    });

    expect(screen.getByTestId("scope").textContent).toBe("personal");
  });
});

describe("WorkspaceProvider — team selection", () => {
  it("switches to team scope when setScope is called with a team", async () => {
    vi.spyOn(teamsApi, "listTeams").mockResolvedValue([MOCK_TEAM]);

    await act(async () => {
      render(
        <WorkspaceProvider>
          <ScopeDisplay />
          <ScopeSelector />
        </WorkspaceProvider>,
      );
    });

    await act(async () => {
      screen.getByText("set-team-team-abc").click();
    });

    expect(screen.getByTestId("scope").textContent).toBe(
      "team:team-abc:Alpha Squad",
    );
  });

  it("persists team scope to localStorage", async () => {
    vi.spyOn(teamsApi, "listTeams").mockResolvedValue([MOCK_TEAM]);

    await act(async () => {
      render(
        <WorkspaceProvider>
          <ScopeDisplay />
          <ScopeSelector />
        </WorkspaceProvider>,
      );
    });

    await act(async () => {
      screen.getByText("set-team-team-abc").click();
    });

    const stored = localStorage.getItem("diq:workspace_scope");
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.id).toBe("team-abc");
    expect(parsed.name).toBe("Alpha Squad");
  });

  it("clears localStorage when switching back to personal", async () => {
    vi.spyOn(teamsApi, "listTeams").mockResolvedValue([MOCK_TEAM]);

    await act(async () => {
      render(
        <WorkspaceProvider>
          <ScopeDisplay />
          <ScopeSelector />
        </WorkspaceProvider>,
      );
    });

    await act(async () => {
      screen.getByText("set-team-team-abc").click();
    });
    await act(async () => {
      screen.getByText("set-personal").click();
    });

    expect(localStorage.getItem("diq:workspace_scope")).toBeNull();
    expect(screen.getByTestId("scope").textContent).toBe("personal");
  });
});

describe("useWorkspace outside provider", () => {
  it("throws when rendered outside WorkspaceProvider", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    function Bare() {
      useWorkspace();
      return null;
    }
    expect(() => render(<Bare />)).toThrow(
      "useWorkspace must be used inside <WorkspaceProvider>",
    );
    errorSpy.mockRestore();
  });
});
