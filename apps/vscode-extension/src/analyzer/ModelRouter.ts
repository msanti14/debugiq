import type * as vscode from "vscode";
import type { AnalysisMode, SupportedLanguage } from "@debugiq/shared-types";

/**
 * ModelRouter — selects which LLM to use based on mode and language.
 *
 * Phase 0: stub implementation — returns config only, makes zero LLM calls.
 * Phase 2: toLmSelector() / getSelectorsForMode() map mode → vscode.lm
 * selectors for GitHub Copilot.
 *
 * Architecture constraint (ADR-001): LLM calls happen here, in the extension.
 * The backend never receives API keys and never proxies LLM requests.
 *
 * ── Why getSelectorsForMode() exists ────────────────────────────────────────
 * Copilot exposes model families under different names depending on the VS Code
 * version, the Copilot release, and the user's subscription tier.  A single
 * strict selector (e.g. family:"gpt-4o") silently returns [] when the family
 * name changes.  getSelectorsForMode() returns a priority-ordered list so the
 * caller tries all known aliases before giving up.
 */
export interface ModelConfig {
  modelId: string;
  provider: "claude" | "openai" | "demo";
  timeoutMs: number;
}

const MODEL_ROUTING: Record<AnalysisMode, ModelConfig> = {
  quick: {
    modelId: "gpt-4o",
    provider: "openai",
    timeoutMs: 3000,
  },
  learn: {
    modelId: "claude-sonnet-4-20250514",
    provider: "claude",
    timeoutMs: 15000,
  },
};

/**
 * Priority-ordered selectors for Quick mode (fast / GPT / o-series models).
 * Each entry is tried in sequence; the first one that returns ≥1 model wins.
 */
const QUICK_SELECTORS: ReadonlyArray<vscode.LanguageModelChatSelector> = [
  { vendor: "copilot", family: "gpt-4o" },
  { vendor: "copilot", family: "gpt-4.1" },
  { vendor: "copilot", family: "o4-mini" },
  { vendor: "copilot", family: "o3-mini" },
  { vendor: "copilot", family: "o1-mini" },
  { vendor: "copilot", family: "o1" },
];

/**
 * Priority-ordered selectors for Learn mode (high-quality / Claude models).
 * Each entry is tried in sequence; the first one that returns ≥1 model wins.
 *
 * Covers all known Claude family name variants across Copilot releases.
 * Entries with the .6 / .5 suffix were confirmed available in VS Code 1.110.1.
 */
const LEARN_SELECTORS: ReadonlyArray<vscode.LanguageModelChatSelector> = [
  // ── Current generation (confirmed in VS Code 1.110.1) ──────────────────────
  { vendor: "copilot", family: "claude-sonnet-4.6" },
  { vendor: "copilot", family: "claude-sonnet-4.5" },
  { vendor: "copilot", family: "claude-opus-4.6" },
  { vendor: "copilot", family: "claude-opus-4.5" },
  { vendor: "copilot", family: "claude-opus-4.6-fast" },
  { vendor: "copilot", family: "claude-haiku-4.5" },
  // ── Previous generation aliases (kept for older VS Code builds) ───────────
  { vendor: "copilot", family: "claude-sonnet-4" },
  { vendor: "copilot", family: "claude-3-7-sonnet" },
  { vendor: "copilot", family: "claude-3.5-sonnet" },
  { vendor: "copilot", family: "claude-3-sonnet" },
];

export class ModelRouter {
  route(mode: AnalysisMode, _language: SupportedLanguage): ModelConfig {
    return MODEL_ROUTING[mode];
  }

  demoConfig(): ModelConfig {
    return { modelId: "demo", provider: "demo", timeoutMs: 0 };
  }

  /**
   * Returns the single "preferred" selector for the given mode.
   * Kept for backwards compatibility; prefer getSelectorsForMode() for
   * resilient multi-fallback selection.
   */
  toLmSelector(
    mode: AnalysisMode,
    _language: SupportedLanguage,
  ): vscode.LanguageModelChatSelector {
    return this.getSelectorsForMode(mode)[0];
  }

  /**
   * Returns the full priority-ordered list of selectors for a given mode.
   *
   * The caller should iterate over this list and use the first selector that
   * produces ≥1 model.  Trying all known aliases ensures the extension
   * continues to work when Copilot updates its model family naming.
   */
  getSelectorsForMode(mode: AnalysisMode): ReadonlyArray<vscode.LanguageModelChatSelector> {
    return mode === "learn" ? LEARN_SELECTORS : QUICK_SELECTORS;
  }
}
