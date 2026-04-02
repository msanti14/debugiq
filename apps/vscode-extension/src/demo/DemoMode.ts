import type { AnalysisResult } from "@debugiq/shared-types";

/**
 * DemoMode — returns pre-built fixture results without any network calls.
 *
 * This module must remain free of any import that touches:
 * - fetch / HTTP
 * - KeychainService
 * - AuthService
 * - BackendClient
 *
 * It is the entry point for users who have not configured an API key,
 * and must work in a completely offline environment.
 */
export class DemoMode {
  isEnabled(): boolean {
    // Phase 0: always available. Phase 1: controlled by config flag.
    return true;
  }

  getFixtures(): AnalysisResult[] {
    return DEMO_FIXTURES;
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DEMO_FIXTURES: AnalysisResult[] = [
  {
    result_id: "demo-001",
    user_id: "demo-user",
    language: "python",
    mode: "quick",
    code_hash: "a".repeat(64),
    findings_count: 3,
    demo_mode: true,
    model_used: "demo",
    analyzed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    findings: [
      {
        id: "f-001",
        category: "sql_injection",
        severity: "critical",
        title: "SQL query built with string concatenation",
        description:
          "User input is concatenated directly into a SQL query. An attacker can manipulate the query to read or delete arbitrary data.",
        line_start: 14,
        line_end: 14,
        fix_hint: "Use parameterized queries: cursor.execute(query, (user_id,))",
      },
      {
        id: "f-002",
        category: "hardcoded_secret",
        severity: "critical",
        title: "API key hardcoded in source",
        description:
          'A string matching the pattern of an API key is assigned to a variable named "api_key". This will be exposed if the file is committed to version control.',
        line_start: 3,
        line_end: 3,
        fix_hint: 'Use os.environ.get("API_KEY") and store the value in a .env file.',
      },
      {
        id: "f-003",
        category: "bare_exception",
        severity: "medium",
        title: "Bare except clause swallows all errors",
        description:
          "A bare `except:` catches every exception including KeyboardInterrupt and SystemExit, making the program impossible to stop and hiding real bugs.",
        line_start: 22,
        line_end: 24,
        fix_hint: "Replace with `except Exception as e:` and log or re-raise.",
      },
    ],
  },
  {
    result_id: "demo-002",
    user_id: "demo-user",
    language: "typescript",
    mode: "quick",
    code_hash: "b".repeat(64),
    findings_count: 2,
    demo_mode: true,
    model_used: "demo",
    analyzed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    findings: [
      {
        id: "f-004",
        category: "null_unhandled",
        severity: "high",
        title: "Possible null dereference on API response",
        description:
          "The code accesses `.data.user.id` without checking if `data`, `user`, or `id` are defined. If the API returns a partial response, this throws at runtime.",
        line_start: 31,
        line_end: 31,
        fix_hint: "Use optional chaining: response.data?.user?.id",
      },
      {
        id: "f-005",
        category: "client_side_auth",
        severity: "critical",
        title: "Authorization check performed only in the browser",
        description:
          "The route guard `if (user.role === 'admin')` runs in client-side code. Any user can bypass it by modifying the value in DevTools. All authorization must be enforced server-side.",
        line_start: 8,
        line_end: 10,
        fix_hint: "Move role validation to the API endpoint; return 403 if unauthorized.",
      },
    ],
  },
  {
    result_id: "demo-003",
    user_id: "demo-user",
    language: "python",
    mode: "learn",
    code_hash: "c".repeat(64),
    findings_count: 1,
    demo_mode: true,
    model_used: "demo",
    analyzed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    findings: [
      {
        id: "f-006",
        category: "null_unhandled",
        severity: "high",
        title: "None check missing before attribute access",
        description:
          "The function calls `.strip()` on a value that `dict.get()` can return as None. This raises AttributeError in production when the key is absent.",
        line_start: 7,
        line_end: 7,
        fix_hint: "Add a None guard: `value = data.get('name'); if value: value.strip()`",
        explanation:
          "In Python, `dict.get(key)` returns `None` if the key doesn't exist — it never raises an error. The problem happens one step later, when you call a method on that `None`. Think of it like reaching into a bag that might be empty: `get()` is the reach, and calling `.strip()` is trying to use what you grabbed. If the bag was empty, you're holding nothing.\n\nWhy AI generates this pattern: AI models trained on code often see `data.get('name').strip()` in examples where the data is guaranteed to exist. They reproduce the pattern without modeling the case where it might not.\n\nFix exercise: before applying the auto-fix, try rewriting line 7 yourself with an explicit None check. What are the two ways to write it in Python?",
      },
    ],
  },
];
