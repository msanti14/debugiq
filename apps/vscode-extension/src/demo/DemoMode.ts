import type { AnalysisResult, AnalysisMode, SupportedLanguage } from "@debugiq/shared-types";

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
    return true;
  }

  getFixtures(): AnalysisResult[] {
    return DEMO_FIXTURES;
  }

  /**
   * Returns the fixture matching (language, mode).
   * Falls back to the first fixture if no exact match is found.
   */
  getFixture(language: SupportedLanguage, mode: AnalysisMode): AnalysisResult {
    const match = DEMO_FIXTURES.find(
      (r) => r.language === language && r.mode === mode,
    );
    return match ?? DEMO_FIXTURES[0];
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DEMO_FIXTURES: AnalysisResult[] = [
  // demo-001 · python · quick · sql_injection · critical
  {
    result_id: "demo-001",
    user_id: "demo-user",
    language: "python",
    mode: "quick",
    code_hash: "a".repeat(64),
    findings_count: 1,
    demo_mode: true,
    model_used: "demo",
    analyzed_at: "2026-04-02T00:00:00.000Z",
    created_at: "2026-04-02T00:00:00.000Z",
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
    ],
  },

  // demo-002 · typescript · quick · null_unhandled · high
  {
    result_id: "demo-002",
    user_id: "demo-user",
    language: "typescript",
    mode: "quick",
    code_hash: "b".repeat(64),
    findings_count: 1,
    demo_mode: true,
    model_used: "demo",
    analyzed_at: "2026-04-02T00:00:00.000Z",
    created_at: "2026-04-02T00:00:00.000Z",
    findings: [
      {
        id: "f-002",
        category: "null_unhandled",
        severity: "high",
        title: "Possible null dereference on API response",
        description:
          "The code accesses `.data.user.id` without checking if `data`, `user`, or `id` are defined. If the API returns a partial response, this throws at runtime.",
        line_start: 31,
        line_end: 31,
        fix_hint: "Use optional chaining: response.data?.user?.id",
      },
    ],
  },

  // demo-003 · python · learn · bare_exception · medium
  {
    result_id: "demo-003",
    user_id: "demo-user",
    language: "python",
    mode: "learn",
    code_hash: "c".repeat(64),
    findings_count: 1,
    demo_mode: true,
    model_used: "demo",
    analyzed_at: "2026-04-02T00:00:00.000Z",
    created_at: "2026-04-02T00:00:00.000Z",
    findings: [
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
        explanation:
          "## What\n" +
          "A bare `except:` clause catches *every* exception — including `KeyboardInterrupt` (Ctrl-C) and `SystemExit` — not just the ones you intended to handle.\n\n" +
          "## Why it's wrong\n" +
          "Python's exception hierarchy has a base class `BaseException`. `KeyboardInterrupt` and `SystemExit` inherit from it directly, not from `Exception`. A bare `except:` catches `BaseException` and all subclasses. That means pressing Ctrl-C will silently fail to stop your program, and `sys.exit()` calls will be swallowed.\n\n" +
          "## What could fail\n" +
          "1. Long-running scripts become impossible to interrupt without killing the process.\n" +
          "2. Real errors (e.g., `ValueError`, `IOError`) are caught and silently discarded, hiding bugs that would otherwise surface immediately.\n" +
          "3. Deployment or test tooling that uses `SystemExit` (e.g., `pytest`, `argparse`) may behave unexpectedly inside these blocks.\n\n" +
          "## Exercise\n" +
          "Before applying the auto-fix, try rewriting the `except` block yourself:\n" +
          "1. Which specific exception type(s) is this block actually meant to handle?\n" +
          "2. Write two versions: one with `except Exception as e:` and one that catches only the specific type. Which is more appropriate here?",
      },
    ],
  },
];
