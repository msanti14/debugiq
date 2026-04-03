import * as vscode from "vscode";
import { randomUUID } from "crypto";
import type { Finding, AnalysisResult, SupportedLanguage } from "@debugiq/shared-types";
import { computeCodeHash } from "./QuickAnalyzer";

/**
 * LearnAnalyzer — drives a Learn-mode analysis via vscode.lm.
 *
 * Learn Mode is educational: each finding must include an `explanation`
 * structured with four named sections to teach the user about the bug.
 *
 * Architecture constraint (ADR-001): LLM calls happen here, in the extension.
 * The backend is never involved in model selection or invocation.
 */

// ── buildLearnPrompt ──────────────────────────────────────────────────────────

/**
 * Builds the two-message prompt for a Learn-mode analysis.
 *
 * Message 0 (Assistant / system context): instructs the model to act as a
 * patient debugging mentor and return ONLY a JSON array of findings with
 * detailed educational explanations.
 * Message 1 (User): provides the language name and code to analyse.
 */
export function buildLearnPrompt(
  code: string,
  language: SupportedLanguage,
): vscode.LanguageModelChatMessage[] {
  const systemText = `You are a patient debugging mentor helping a developer learn from their mistakes. \
Analyse the code the user provides and return ONLY a valid JSON array of findings. \
Do not include any prose, markdown, or text outside the JSON array itself. \
If no issues are found, return an empty array: [].

Each finding must be a JSON object with exactly these fields:
- id: string (unique identifier for this finding, e.g. "f-001")
- category: one of "sql_injection" | "null_unhandled" | "hardcoded_secret" | \
"bare_exception" | "client_side_auth" | "cors_misconfigured" | "xss" | "other"
- severity: one of "critical" | "high" | "medium" | "low" | "info"
- title: string (max 80 characters — concise summary of the issue)
- description: string (max 500 characters — what the problem is and why it matters)
- line_start: number (1-indexed line where the issue begins)
- line_end: number (1-indexed line where the issue ends; same as line_start for single-line)
- fix_hint: string (a one-liner concrete fix suggestion)
- explanation: string (required — a detailed educational explanation structured with \
these exact section headers on their own lines, in this order:
  ## What
  ## Why it is wrong
  ## What could fail
  ## Exercise
  Keep each section concise but genuinely educational. \
  Do not use markdown formatting inside the explanation text other than these section headers. \
  The Exercise section should give the reader one concrete thing to try or think about.)

Aim for one to three findings maximum. Be selective and focus on the most instructive issues. \
Keep titles to 80 characters or fewer. Keep descriptions to 500 characters or fewer. \
Do not use markdown formatting (bold, italics, code fences) outside of JSON string values.

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
    "fix_hint": "...",
    "explanation": "## What\\n...\\n\\n## Why it is wrong\\n...\\n\\n## What could fail\\n...\\n\\n## Exercise\\n..."
  }
]`;

  const userText = `Language: ${language}\n\n${code}`;

  return [
    vscode.LanguageModelChatMessage.Assistant(systemText),
    vscode.LanguageModelChatMessage.User(userText),
  ];
}

// ── parseLearnResponse ────────────────────────────────────────────────────────

/**
 * Parses the raw LLM text response into a typed Finding array.
 *
 * Uses the same robustness pattern as QuickAnalyzer.parseResponse:
 * handles plain JSON arrays and markdown code-fenced JSON.
 * Additionally normalises explanation to a non-empty string when present.
 */
export function parseLearnResponse(text: string): Finding[] {
  if (!text.trim()) {
    throw new Error("Empty LLM response");
  }

  // Strip markdown code fences: ```json ... ``` or ``` ... ```
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/;
  const fenceMatch = text.match(fenceRegex);
  const jsonText = fenceMatch ? fenceMatch[1].trim() : text.trim();

  // Extract the JSON array (tolerates leading/trailing whitespace or stray prose)
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

  return (parsed as Record<string, unknown>[]).map((f) => {
    const id = typeof f["id"] === "string" && f["id"] ? f["id"] : randomUUID();
    // Normalise explanation: coerce to string, trim; keep undefined if absent
    const rawExplanation = f["explanation"];
    const explanation =
      typeof rawExplanation === "string" && rawExplanation.trim()
        ? rawExplanation.trim()
        : undefined;
    return { ...f, id, ...(explanation !== undefined ? { explanation } : {}) } as Finding;
  });
}

// ── analyzeLearn ──────────────────────────────────────────────────────────────

/**
 * Runs a full Learn-mode analysis against the provided vscode.lm model.
 * Streams the response, parses it, and returns a complete AnalysisResult
 * with mode set to "learn".
 */
export async function analyzeLearn(
  code: string,
  language: SupportedLanguage,
  model: vscode.LanguageModelChat,
): Promise<AnalysisResult> {
  const startTime = Date.now();

  const messages = buildLearnPrompt(code, language);
  const cts = new vscode.CancellationTokenSource();
  const response = await model.sendRequest(messages, {}, cts.token);

  let fullText = "";
  for await (const chunk of response.text) {
    fullText += chunk;
  }

  const findings = parseLearnResponse(fullText);
  const hash = computeCodeHash(code);
  const now = new Date().toISOString();

  return {
    result_id: randomUUID(),
    user_id: "",
    language,
    mode: "learn",
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
