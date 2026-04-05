"use client";
/**
 * apps/web/src/lib/workspace/context.tsx
 *
 * WorkspaceContext — manages the active workspace scope (personal or a team).
 * Persists team selection to localStorage under "diq:workspace_scope".
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { TeamResponse } from "@debugiq/shared-types";
import { listTeams } from "@/lib/api/teams";
import { useAuth } from "@/lib/auth/context";

// ── Types ─────────────────────────────────────────────────────────────────────

export type TeamScope = { type: "team"; id: string; name: string };
export type WorkspaceScope = "personal" | TeamScope;

interface WorkspaceContextValue {
  scope: WorkspaceScope;
  teams: TeamResponse[];
  teamsLoading: boolean;
  setScope: (scope: WorkspaceScope) => void;
}

const STORAGE_KEY = "diq:workspace_scope";

// ── Context ───────────────────────────────────────────────────────────────────

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [teams, setTeams] = useState<TeamResponse[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [scope, setInternalScope] = useState<WorkspaceScope>("personal");

  // Load teams when user is present
  useEffect(() => {
    if (!user) {
      setTeams([]);
      setTeamsLoading(false);
      return;
    }
    setTeamsLoading(true);
    listTeams()
      .then((data) => {
        setTeams(data);
        // Restore persisted scope
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored) as TeamScope;
            const match = data.find((t) => t.team_id === parsed.id);
            if (match) {
              setInternalScope({ type: "team", id: match.team_id, name: match.name });
            }
          }
        } catch {
          // ignore corrupt storage
        }
      })
      .catch(() => setTeams([]))
      .finally(() => setTeamsLoading(false));
  }, [user]);

  const setScope = useCallback((next: WorkspaceScope) => {
    setInternalScope(next);
    if (next === "personal") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }, []);

  return (
    <WorkspaceContext.Provider value={{ scope, teams, teamsLoading, setScope }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  }
  return ctx;
}
