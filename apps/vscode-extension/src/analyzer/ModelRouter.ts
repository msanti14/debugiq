import type { AnalysisMode, SupportedLanguage } from "@debugiq/shared-types";

/**
 * ModelRouter — selects which LLM to use based on mode and language.
 *
 * Phase 0: stub implementation — returns config only, makes zero LLM calls.
 * Phase 1: will read user's stored API keys from KeychainService and invoke the model.
 *
 * Architecture constraint (ADR-001): LLM calls happen here, in the extension.
 * The backend never receives API keys and never proxies LLM requests.
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

export class ModelRouter {
  route(mode: AnalysisMode, _language: SupportedLanguage): ModelConfig {
    return MODEL_ROUTING[mode];
  }

  demoConfig(): ModelConfig {
    return { modelId: "demo", provider: "demo", timeoutMs: 0 };
  }
}
