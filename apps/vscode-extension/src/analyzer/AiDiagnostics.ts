import * as vscode from "vscode";

/**
 * AiDiagnostics — deterministic AI provider diagnostics for DebugIQ.
 *
 * Why this exists: vscode.lm.selectChatModels() can silently return [] for
 * multiple distinct reasons (no extension active, wrong family name, missing
 * entitlement, LM API error). Without explicit probing it is impossible to
 * tell the user what is actually wrong or how to fix it.
 *
 * Design: pure functions + explicit dependency injection so the module is
 * fully unit-testable outside the VS Code host.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type AiProviderSetting = "auto" | "copilot" | "ollama";

/**
 * Structured information about one discovered language model.
 */
export interface ModelInfo {
  id: string;
  name: string;
  vendor: string;
  family: string;
  version: string;
}

/**
 * Result of one selectChatModels() call with a specific selector.
 * count === -1 means the call threw an exception (captured in errorDetail).
 */
export interface SelectorProbeResult {
  label: string;
  selector: vscode.LanguageModelChatSelector;
  count: number;
  models: ModelInfo[];
  errorDetail?: string;
}

/**
 * Diagnostic failure categories — each maps to a distinct root cause and
 * a targeted recommendation.
 */
export type AiFailureCategory =
  /** vscode.lm is absent — VS Code is older than 1.90 */
  | "LM_API_UNAVAILABLE"
  /** selectChatModels({}) returns [] — no provider registered any model */
  | "NO_MODELS_REGISTERED"
  /** Any model exists but vendor:"copilot" returns [] */
  | "NO_COPILOT_MODELS"
  /** Copilot models exist but the specific family requested is not present */
  | "FAMILY_NOT_AVAILABLE"
  /** selectChatModels threw — likely a permission / entitlement rejection */
  | "LM_API_ERROR"
  /** A usable model was found */
  | "OK";

/**
 * Full diagnostics report produced by runAiDiagnostics().
 */
export interface DiagnosticsReport {
  /** Value of debugiq.aiProvider at time of diagnosis */
  configuredProvider: AiProviderSetting;
  /** vscode.version at time of diagnosis */
  vsCodeVersion: string;
  /** Whether github.copilot is present (built-in counts as present) */
  copilotExtensionFound: boolean;
  /** Whether github.copilot-chat is present */
  copilotChatExtensionFound: boolean;
  /** Results for every selector probe attempted */
  probeResults: SelectorProbeResult[];
  /** First model that can be used, or null */
  selectedModel: ModelInfo | null;
  /** Why no model was selected (null when category === "OK") */
  failureCategory: AiFailureCategory;
  /** Human-readable explanation of the failure */
  failureDetail: string;
  /** Concrete next action for the user */
  recommendation: string;
}

// ── Probe selectors ───────────────────────────────────────────────────────────

/**
 * Ordered list of selectors probed during diagnostics.
 * Broad selectors come last so narrow mismatches are surfaced first.
 */
export const DIAGNOSTIC_PROBES: ReadonlyArray<{ label: string; selector: vscode.LanguageModelChatSelector }> = [
  // ── Quick (GPT / o-series) ────────────────────────────────────────────────
  { label: 'copilot + family:"gpt-4o"',         selector: { vendor: "copilot", family: "gpt-4o" } },
  { label: 'copilot + family:"gpt-4.1"',        selector: { vendor: "copilot", family: "gpt-4.1" } },
  { label: 'copilot + family:"o4-mini"',        selector: { vendor: "copilot", family: "o4-mini" } },
  { label: 'copilot + family:"o3-mini"',        selector: { vendor: "copilot", family: "o3-mini" } },
  { label: 'copilot + family:"o1"',             selector: { vendor: "copilot", family: "o1" } },
  // ── Learn (Claude family — current generation confirmed in 1.110.1) ─────────
  { label: 'copilot + family:"claude-sonnet-4.6"',     selector: { vendor: "copilot", family: "claude-sonnet-4.6" } },
  { label: 'copilot + family:"claude-sonnet-4.5"',     selector: { vendor: "copilot", family: "claude-sonnet-4.5" } },
  { label: 'copilot + family:"claude-opus-4.6"',       selector: { vendor: "copilot", family: "claude-opus-4.6" } },
  { label: 'copilot + family:"claude-opus-4.5"',       selector: { vendor: "copilot", family: "claude-opus-4.5" } },
  { label: 'copilot + family:"claude-haiku-4.5"',      selector: { vendor: "copilot", family: "claude-haiku-4.5" } },
  // ── Learn (Claude family — previous generation aliases) ──────────────────
  { label: 'copilot + family:"claude-sonnet-4"',     selector: { vendor: "copilot", family: "claude-sonnet-4" } },
  { label: 'copilot + family:"claude-3-7-sonnet"',   selector: { vendor: "copilot", family: "claude-3-7-sonnet" } },
  { label: 'copilot + family:"claude-3.5-sonnet"',   selector: { vendor: "copilot", family: "claude-3.5-sonnet" } },
  { label: 'copilot + family:"claude-3-sonnet"',     selector: { vendor: "copilot", family: "claude-3-sonnet" } },
  // ── Broad fallbacks ───────────────────────────────────────────────────────
  { label: 'copilot vendor (any family)',        selector: { vendor: "copilot" } },
  { label: '(no filter — all registered models)', selector: {} },
];

// ── LM API interface (for dependency injection in tests) ──────────────────────

export interface LmApi {
  selectChatModels(selector?: vscode.LanguageModelChatSelector): Thenable<vscode.LanguageModelChat[]>;
}

export interface ExtensionsApi {
  getExtension(id: string): { id: string } | undefined;
}

// ── Core diagnostics function ─────────────────────────────────────────────────

/**
 * Runs all diagnostic probes and returns a fully structured report.
 *
 * @param configuredProvider  Value of debugiq.aiProvider setting.
 * @param vsCodeVersion       vscode.version string.
 * @param lm                  vscode.lm (injected for testability).
 * @param extensions          vscode.extensions (injected for testability).
 */
export async function runAiDiagnostics(
  configuredProvider: AiProviderSetting,
  vsCodeVersion: string,
  lm: LmApi,
  extensions: ExtensionsApi,
): Promise<DiagnosticsReport> {
  const copilotExtensionFound =
    extensions.getExtension("github.copilot") !== undefined;
  const copilotChatExtensionFound =
    extensions.getExtension("github.copilot-chat") !== undefined;

  // Guard: lm API availability
  if (typeof lm.selectChatModels !== "function") {
    return makeReport(configuredProvider, vsCodeVersion, copilotExtensionFound, copilotChatExtensionFound, [], null, {
      failureCategory: "LM_API_UNAVAILABLE",
      failureDetail: "vscode.lm.selectChatModels is not a function. The Language Model API requires VS Code 1.90 or later.",
      recommendation: "Upgrade VS Code to version 1.90 or later.",
    });
  }

  // Run all probes
  const probeResults: SelectorProbeResult[] = [];
  let firstUsableModel: ModelInfo | null = null;

  for (const { label, selector } of DIAGNOSTIC_PROBES) {
    try {
      const models = await lm.selectChatModels(selector);
      const modelInfos: ModelInfo[] = models.map(toModelInfo);
      probeResults.push({ label, selector, count: models.length, models: modelInfos });
      if (models.length > 0 && firstUsableModel === null) {
        firstUsableModel = modelInfos[0];
      }
    } catch (err) {
      const errorDetail = String(err);
      probeResults.push({ label, selector, count: -1, models: [], errorDetail });
    }
  }

  // Determine outcome ─────────────────────────────────────────────────────────

  if (firstUsableModel !== null) {
    return makeReport(configuredProvider, vsCodeVersion, copilotExtensionFound, copilotChatExtensionFound, probeResults, firstUsableModel, {
      failureCategory: "OK",
      failureDetail: "",
      recommendation:
        `Model "${firstUsableModel.name}" (${firstUsableModel.id}) is available. ` +
        "If Quick Debug / Learn Debug still fall back to demo, verify debugiq.aiProvider is not set to 'ollama'.",
    });
  }

  // All probes returned 0 or errored
  const anyError = probeResults.find((r) => r.count === -1);
  if (anyError) {
    return makeReport(configuredProvider, vsCodeVersion, copilotExtensionFound, copilotChatExtensionFound, probeResults, null, {
      failureCategory: "LM_API_ERROR",
      failureDetail:
        `vscode.lm.selectChatModels threw an exception: ${anyError.errorDetail ?? "unknown error"}. ` +
        "This usually indicates a missing entitlement or a trust/permission rejection.",
      recommendation:
        "Reload the VS Code window (Developer: Reload Window). If the error persists, open the GitHub Copilot Chat panel to re-authenticate, then run this command again.",
    });
  }

  const noFilterResult = probeResults.find((r) => Object.keys(r.selector).length === 0);
  const copilotVendorResult = probeResults.find(
    (r) => r.selector.vendor === "copilot" && !r.selector.family,
  );

  if (noFilterResult && noFilterResult.count === 0) {
    // Truly no models anywhere
    if (!copilotExtensionFound && !copilotChatExtensionFound) {
      return makeReport(configuredProvider, vsCodeVersion, copilotExtensionFound, copilotChatExtensionFound, probeResults, null, {
        failureCategory: "NO_MODELS_REGISTERED",
        failureDetail: "selectChatModels() returned 0 models for every selector, including no-filter. Neither github.copilot nor github.copilot-chat was detected.",
        recommendation: "Install the GitHub Copilot Chat extension from the VS Code Marketplace, sign in with your GitHub account, and retry.",
      });
    }

    if (!copilotExtensionFound && copilotChatExtensionFound) {
      return makeReport(configuredProvider, vsCodeVersion, copilotExtensionFound, copilotChatExtensionFound, probeResults, null, {
        failureCategory: "NO_MODELS_REGISTERED",
        failureDetail:
          "selectChatModels() returned 0 models for every selector. github.copilot-chat is installed but github.copilot base extension is missing. " +
          "In VS Code 1.99+ the base extension is bundled as a built-in — if it does not appear in the installed list this may be normal. " +
          "Open the GitHub Copilot Chat panel (Ctrl+Alt+I) to verify authentication.",
        recommendation:
          "Open the GitHub Copilot Chat panel (Ctrl+Alt+I). If not signed in, sign in through VS Code Accounts. Then run 'DebugIQ: Diagnose AI Provider' again.",
      });
    }

    return makeReport(configuredProvider, vsCodeVersion, copilotExtensionFound, copilotChatExtensionFound, probeResults, null, {
      failureCategory: "NO_MODELS_REGISTERED",
      failureDetail:
        "Both Copilot extensions are detected but selectChatModels() still returns 0 models. " +
        "The Language Model API only returns models once Copilot Chat has fully initialized (i.e. the Chat panel has been opened at least once).",
      recommendation:
        "Open the GitHub Copilot Chat panel (Ctrl+Alt+I) and verify you are signed in and a model is selected. Then run 'DebugIQ: Diagnose AI Provider' again.",
    });
  }

  if (copilotVendorResult && copilotVendorResult.count === 0) {
    return makeReport(configuredProvider, vsCodeVersion, copilotExtensionFound, copilotChatExtensionFound, probeResults, null, {
      failureCategory: "NO_COPILOT_MODELS",
      failureDetail:
        "selectChatModels({ vendor: 'copilot' }) returned 0 models, but other vendors may be present. " +
        "Your Copilot subscription may not include API access, or Copilot Chat has not registered its models yet.",
      recommendation:
        "Open the GitHub Copilot Chat panel and confirm you can send a message. If your Copilot plan does not include API access, switch debugiq.aiProvider to 'ollama'.",
    });
  }

  // Copilot vendor has models but specific families weren't matched (handled above by firstUsableModel)
  return makeReport(configuredProvider, vsCodeVersion, copilotExtensionFound, copilotChatExtensionFound, probeResults, null, {
    failureCategory: "FAMILY_NOT_AVAILABLE",
    failureDetail: "Copilot models exist but the families requested (gpt-4o, claude-sonnet-4, etc.) were not matched. The probe list may need updating for this VS Code / Copilot version.",
    recommendation: "Run 'DebugIQ: Diagnose AI Provider' and inspect the discovered model IDs/families. Report them at https://github.com/debugiq/debugiq/issues so the selector list can be updated.",
  });
}

// ── Report formatting ─────────────────────────────────────────────────────────

/**
 * Renders a DiagnosticsReport as a human-readable plain-text string suitable
 * for a VS Code Output Channel.
 */
export function formatDiagnosticsReport(report: DiagnosticsReport): string {
  const lines: string[] = [
    "══════════════════════════════════════════════════",
    "  DebugIQ — AI Provider Diagnostics",
    "══════════════════════════════════════════════════",
    "",
    `  VS Code version        : ${report.vsCodeVersion}`,
    `  Configured aiProvider  : ${report.configuredProvider}`,
    `  github.copilot         : ${report.copilotExtensionFound ? "found" : "NOT found"}`,
    `  github.copilot-chat    : ${report.copilotChatExtensionFound ? "found" : "NOT found"}`,
    "",
    "── Selector probes ────────────────────────────────",
  ];

  for (const r of report.probeResults) {
    const countLabel =
      r.count === -1 ? "ERROR" : `${r.count} model(s)`;
    lines.push(`  ${r.label}`);
    lines.push(`    → ${countLabel}${r.errorDetail ? ` [${r.errorDetail}]` : ""}`);
    for (const m of r.models) {
      lines.push(`       • id="${m.id}"  name="${m.name}"  vendor="${m.vendor}"  family="${m.family}"  version="${m.version}"`);
    }
  }

  lines.push("");
  lines.push("── Result ─────────────────────────────────────────");

  if (report.failureCategory === "OK" && report.selectedModel) {
    const m = report.selectedModel;
    lines.push(`  Status        : OK`);
    lines.push(`  Selected model: ${m.name} (id="${m.id}"  vendor="${m.vendor}"  family="${m.family}")`);
  } else {
    lines.push(`  Status        : FAILED`);
    lines.push(`  Failure code  : ${report.failureCategory}`);
    lines.push(`  Detail        : ${report.failureDetail}`);
  }

  lines.push("");
  lines.push("── Recommendation ─────────────────────────────────");
  lines.push(`  ${report.recommendation}`);
  lines.push("");
  lines.push("══════════════════════════════════════════════════");

  return lines.join("\n");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toModelInfo(m: vscode.LanguageModelChat): ModelInfo {
  return {
    id: m.id ?? "",
    name: m.name ?? "",
    vendor: m.vendor ?? "",
    family: m.family ?? "",
    version: m.version ?? "",
  };
}

function makeReport(
  configuredProvider: AiProviderSetting,
  vsCodeVersion: string,
  copilotExtensionFound: boolean,
  copilotChatExtensionFound: boolean,
  probeResults: SelectorProbeResult[],
  selectedModel: ModelInfo | null,
  outcome: { failureCategory: AiFailureCategory; failureDetail: string; recommendation: string },
): DiagnosticsReport {
  return {
    configuredProvider,
    vsCodeVersion,
    copilotExtensionFound,
    copilotChatExtensionFound,
    probeResults,
    selectedModel,
    ...outcome,
  };
}
