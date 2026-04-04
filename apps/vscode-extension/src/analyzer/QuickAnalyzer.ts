import * as vscode from "vscode";
import { createHash, randomUUID } from "crypto";
import type { Finding, AnalysisResult, SupportedLanguage } from "@debugiq/shared-types";
import type { UiLanguage } from "../i18n";

/**
 * QuickAnalyzer — drives a single Quick-mode analysis via vscode.lm.
 *
 * All four exports are pure functions (no class) to make them individually
 * testable without a vscode host.
 *
 * Architecture constraint (ADR-001): LLM calls happen here, in the extension.
 * The backend is never involved in model selection or invocation.
 */

// ── buildPrompt ───────────────────────────────────────────────────────────────

/**
 * Builds the two-message prompt for a Quick-mode analysis.
 *
 * Message 0 (Assistant / system context): instructs the model to return ONLY
 * a JSON array of findings with no prose.
 * Message 1 (User): provides the language name and code to analyse.
 */
export function buildPrompt(
  code: string,
  language: SupportedLanguage,
  responseLanguage: UiLanguage = "en",
): vscode.LanguageModelChatMessage[] {
  const localeInstruction =
    responseLanguage === "es"
      ? "Write title, description, and fix_hint in Spanish."
      : "Write title, description, and fix_hint in English.";

  const systemText = `You are a security-focused code reviewer. \
Analyse the code the user provides and return ONLY a valid JSON array of findings. \
Do not include any prose, explanation, or markdown outside the JSON array. \
If no issues are found, return an empty array: [].

${localeInstruction}

Each finding must be a JSON object with exactly these fields:
- id: string (unique identifier for this finding)
- category: one of "sql_injection" | "null_unhandled" | "hardcoded_secret" | \
"bare_exception" | "client_side_auth" | "cors_misconfigured" | "xss" | "other"
- severity: one of "critical" | "high" | "medium" | "low" | "info"
- title: string (max 80 characters — concise summary)
- description: string (max 500 characters — what the problem is and why it matters)
- line_start: number (1-indexed line where the issue begins)
- line_end: number (1-indexed line where the issue ends; same as line_start for single-line)
- fix_hint: string (a one-liner concrete fix suggestion, required)

Output format — respond with ONLY this structure, nothing else:
[
  {
    "id": "f-001",
    "category": "sql_injection",
    "severity": "critical",
    "title": "...",
    "description": "...",
    "line_start": 5,
    "line_end": 5,
    "fix_hint": "..."
  }
]`;

  const userText = `Language: ${language}\n\n${code}`;

  return [
    vscode.LanguageModelChatMessage.Assistant(systemText),
    vscode.LanguageModelChatMessage.User(userText),
  ];
}

// ── parseResponse ─────────────────────────────────────────────────────────────

/**
 * Parses the raw LLM text response into a typed Finding array.
 *
 * Handles the common case where gpt-4o wraps its output in a markdown
 * code fence (```json ... ``` or ``` ... ```).
 */
export function parseResponse(text: string): Finding[] {
  if (!text.trim()) {
    throw new Error("Empty LLM response");
  }

  // Strip markdown code fences: ```json ... ``` or ``` ... ```
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/;
  const fenceMatch = text.match(fenceRegex);
  const jsonText = fenceMatch ? fenceMatch[1].trim() : text.trim();

  // Extract the JSON array (tolerates leading/trailing whitespace or prose)
  const arrayMatch = jsonText.match(/\[[\s\S]*\]/);
  if (!arrayMatch) {
    throw new Error("No JSON array found in response");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(arrayMatch[0]);
  } catch {
    throw new Error("No JSON array found in response");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("LLM response is not a JSON array");
  }

  return (parsed as Record<string, unknown>[]).map((f) => ({
    ...f,
    id: typeof f["id"] === "string" && f["id"] ? f["id"] : randomUUID(),
  })) as Finding[];
}

// ── computeCodeHash ───────────────────────────────────────────────────────────

/**
 * Returns the SHA-256 hex digest of the given source code string.
 * The raw code is never stored — only this hash reaches the backend.
 */
export function computeCodeHash(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

// ── analyze ───────────────────────────────────────────────────────────────────

/**
 * Runs a full Quick analysis against the provided vscode.lm model.
 * Streams the response, parses it, and returns a complete AnalysisResult.
 */
export async function analyze(
  code: string,
  language: SupportedLanguage,
  model: vscode.LanguageModelChat,
  responseLanguage: UiLanguage = "en",
): Promise<AnalysisResult> {
  const startTime = Date.now();

  const messages = buildPrompt(code, language, responseLanguage);
  const cts = new vscode.CancellationTokenSource();
  const response = await model.sendRequest(messages, {}, cts.token);

  let fullText = "";
  for await (const chunk of response.text) {
    fullText += chunk;
  }

  const findings = parseResponse(fullText);
  const hash = computeCodeHash(code);
  const now = new Date().toISOString();

  return {
    result_id: randomUUID(),
    user_id: "",
    language,
    mode: "quick",
    code_hash: hash,
    findings_count: findings.length,
    findings,
    model_used: model.name ?? model.id,
    duration_ms: Date.now() - startTime,
    demo_mode: false,
    analyzed_at: now,
    created_at: now,
  };
}
