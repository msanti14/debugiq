import { randomUUID } from "crypto";
import type { AnalysisResult, SupportedLanguage } from "@debugiq/shared-types";
import { computeCodeHash, parseResponse } from "./QuickAnalyzer";
import { parseLearnResponse } from "./LearnAnalyzer";
import type { UiLanguage } from "../i18n";

export interface OllamaConfig {
  baseUrl: string;
  model: string;
}

export async function analyzeWithOllama(
  code: string,
  language: SupportedLanguage,
  mode: "quick" | "learn",
  config: OllamaConfig,
  responseLanguage: UiLanguage,
): Promise<AnalysisResult> {
  const started = Date.now();
  const now = new Date().toISOString();
  const prompt = buildOllamaPrompt(code, language, mode, responseLanguage);

  const response = await fetch(normalizeBaseUrl(config.baseUrl) + "/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      prompt,
      stream: false,
      options: {
        temperature: mode === "learn" ? 0.3 : 0.2,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Ollama HTTP ${response.status}: ${text}`);
  }

  const payload = (await response.json()) as { response?: string };
  const raw = payload.response?.trim();
  if (!raw) {
    throw new Error("Ollama returned an empty response");
  }

  const findings = mode === "learn" ? parseLearnResponse(raw) : parseResponse(raw);

  return {
    result_id: randomUUID(),
    user_id: "",
    language,
    mode,
    code_hash: computeCodeHash(code),
    findings_count: findings.length,
    findings,
    model_used: `ollama:${config.model}`,
    duration_ms: Date.now() - started,
    demo_mode: false,
    analyzed_at: now,
    created_at: now,
  };
}

function normalizeBaseUrl(url: string): string {
  return (url || "http://localhost:11434").replace(/\/$/, "");
}

function buildOllamaPrompt(
  code: string,
  language: SupportedLanguage,
  mode: "quick" | "learn",
  responseLanguage: UiLanguage,
): string {
  const localeInstruction =
    responseLanguage === "es"
      ? "Write title, description, and fix_hint in Spanish."
      : "Write title, description, and fix_hint in English.";

  if (mode === "learn") {
    const learnLocale =
      responseLanguage === "es"
        ? "Write title, description, fix_hint, and explanation content in Spanish. Keep the required explanation section headers exactly in English."
        : "Write title, description, fix_hint, and explanation content in English.";

    return `You are a patient debugging mentor helping a developer learn from mistakes.
Analyze the code and return ONLY a valid JSON array. Do not return markdown.
${learnLocale}

Each finding must include:
- id: string
- category: one of sql_injection|null_unhandled|hardcoded_secret|bare_exception|client_side_auth|cors_misconfigured|xss|other
- severity: one of critical|high|medium|low|info
- title: string (<=80 chars)
- description: string (<=500 chars)
- line_start: number (1-indexed)
- line_end: number (1-indexed)
- fix_hint: string
- explanation: string with sections in this exact order:
  ## What
  ## Why it is wrong
  ## What could fail
  ## Exercise

If no issues are found, return []

Language: ${language}
Code:
${code}`;
  }

  return `You are a security-focused code reviewer.
Analyze the code and return ONLY a valid JSON array. Do not return markdown.
${localeInstruction}

Each finding must include:
- id: string
- category: one of sql_injection|null_unhandled|hardcoded_secret|bare_exception|client_side_auth|cors_misconfigured|xss|other
- severity: one of critical|high|medium|low|info
- title: string (<=80 chars)
- description: string (<=500 chars)
- line_start: number (1-indexed)
- line_end: number (1-indexed)
- fix_hint: string

If no issues are found, return []

Language: ${language}
Code:
${code}`;
}
