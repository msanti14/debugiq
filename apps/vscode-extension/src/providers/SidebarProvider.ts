import * as vscode from "vscode";
import type { AnalysisResult, Finding } from "@debugiq/shared-types";
import type { UiLanguage } from "../i18n";

/**
 * SignatureInfo carries the computed bug signature and its classification
 * (new vs. repeated) to be displayed in the sidebar panel.
 */
export interface SignatureInfo {
  signature: string;
  status: "new" | "repeated";
}

/**
 * SidebarProvider manages the DebugIQ webview panel.
 *
 * - `show(result, signatureInfo?)` creates the panel on first call and reveals
 *   it on subsequent calls. The panel title updates on every call to reflect
 *   the current analysis mode.
 * - `renderHtml(result, signatureInfo?)` is a pure static method — usable in
 *   tests without a vscode context.
 */
export class SidebarProvider {
  private panel: vscode.WebviewPanel | undefined;

  show(result: AnalysisResult, signatureInfo?: SignatureInfo, suggestions?: string[], language: UiLanguage = "en"): void {
    const panelTitle = derivePanelTitle(result, language);

    if (this.panel) {
      this.panel.title = panelTitle;
      this.panel.reveal(vscode.ViewColumn.Beside);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        "debugiqResults",
        panelTitle,
        vscode.ViewColumn.Beside,
        {
          enableScripts: false,
          retainContextWhenHidden: true,
        },
      );

      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });
    }

    this.panel.webview.html = SidebarProvider.renderHtml(result, signatureInfo, suggestions, language);
  }

  /**
   * Pure static renderer — no vscode dependency, fully testable.
   * Findings are sorted by severity (critical → high → medium → low → info).
   * Optional `signatureInfo` renders a signature status section at the top.
   * Optional `suggestions` renders a "Suggested next steps" section below the
   * signature section. All strings are HTML-escaped before rendering.
   */
  static renderHtml(result: AnalysisResult, signatureInfo?: SignatureInfo, suggestions?: string[], language: UiLanguage = "en"): string {
    const severityOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
      info: 4,
    };

    const sorted = [...result.findings].sort(
      (a, b) =>
        (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99),
    );

    const findingItems = sorted.map((f) => renderFinding(f, result.mode)).join("\n");

    const modeLabel = result.mode === "learn" ? t(language, "modeLearn") : t(language, "modeQuick");
    const langLabel =
      result.language.charAt(0).toUpperCase() + result.language.slice(1);

    const heading = result.demo_mode
      ? t(language, "headingDemo")
      : result.mode === "learn"
        ? t(language, "headingLearn")
        : t(language, "headingAnalysis");

    const subLabel = result.demo_mode ? t(language, "subNoApiKey") : "";

    const signatureSection = signatureInfo
      ? renderSignatureSection(signatureInfo, language)
      : "";

    const suggestionsSection =
      suggestions && suggestions.length > 0
        ? renderSuggestionsSection(suggestions, language)
        : "";

      const findingLabel = result.findings_count === 1 ? t(language, "findingOne") : t(language, "findingMany");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DebugIQ</title>
  <style>
    body {
      font-family: var(--vscode-font-family, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--vscode-foreground, #cccccc);
      background: var(--vscode-editor-background, #1e1e1e);
      padding: 16px 20px;
      margin: 0;
    }
    h2 {
      font-size: 1.1em;
      margin: 0 0 4px 0;
      color: var(--vscode-foreground, #cccccc);
    }
    .meta {
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground, #888);
      margin-bottom: 20px;
    }
    /* Signature section */
    .signature-section {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: 0.82em;
      margin-bottom: 16px;
      padding: 8px 12px;
      background: var(--vscode-editorWidget-background, #252526);
      border: 1px solid var(--vscode-editorWidget-border, #454545);
      border-radius: 4px;
    }
    .sig-label {
      color: var(--vscode-descriptionForeground, #888);
      flex-shrink: 0;
    }
    .sig-value {
      font-family: var(--vscode-editor-font-family, monospace);
      color: var(--vscode-foreground, #cccccc);
      letter-spacing: 0.02em;
    }
    .sig-status {
      font-weight: 700;
      font-size: 0.9em;
      padding: 1px 6px;
      border-radius: 3px;
      flex-shrink: 0;
    }
    .sig-new      { background: #cc6d00; color: #fff; }
    .sig-repeated { background: #2e7d32; color: #fff; }
    .finding {
      border: 1px solid var(--vscode-editorWidget-border, #454545);
      border-radius: 4px;
      padding: 12px 14px;
      margin-bottom: 12px;
      background: var(--vscode-editorWidget-background, #252526);
    }
    .finding-header {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 6px;
    }
    .badge {
      font-size: 0.75em;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 3px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      flex-shrink: 0;
    }
    .badge-critical { background: #c72e2e; color: #fff; }
    .badge-high     { background: #cc6d00; color: #fff; }
    .badge-medium   { background: #b5a000; color: #1a1a1a; }
    .badge-low      { background: #2e7d32; color: #fff; }
    .badge-info     { background: #1565c0; color: #fff; }
    .finding-title {
      font-weight: 600;
      font-size: 0.95em;
    }
    .finding-location {
      font-size: 0.8em;
      color: var(--vscode-descriptionForeground, #888);
      margin-bottom: 6px;
    }
    .finding-desc {
      margin: 0 0 8px 0;
      line-height: 1.5;
    }
    .fix-hint {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 0.85em;
      background: var(--vscode-textCodeBlock-background, #0a0a0a);
      border-left: 3px solid var(--vscode-textLink-foreground, #3794ff);
      padding: 6px 10px;
      margin: 0;
      white-space: pre-wrap;
      border-radius: 0 3px 3px 0;
    }
    /* Learn Mode explanation container */
    .explanation {
      margin-top: 12px;
      padding: 12px 14px;
      background: var(--vscode-textBlockQuote-background, #2a2d2e);
      border-left: 3px solid var(--vscode-textLink-foreground, #3794ff);
      border-radius: 0 3px 3px 0;
      font-size: 0.9em;
      line-height: 1.6;
    }
    /* Individual section within explanation */
    .explanation-section {
      margin-bottom: 10px;
    }
    .explanation-section:last-child {
      margin-bottom: 0;
    }
    /* Section heading (## What, ## Why it is wrong, etc.) */
    .explanation-heading {
      display: block;
      font-weight: 700;
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--vscode-textLink-foreground, #3794ff);
      margin-bottom: 4px;
    }
    /* Section body text */
    .explanation-body {
      white-space: pre-wrap;
      margin: 0;
    }
    /* Suggestions section */
    .suggestions-section {
      font-size: 0.85em;
      margin-bottom: 16px;
      padding: 8px 12px;
      background: var(--vscode-editorWidget-background, #252526);
      border: 1px solid var(--vscode-editorWidget-border, #454545);
      border-left: 3px solid var(--vscode-textLink-foreground, #3794ff);
      border-radius: 0 4px 4px 0;
    }
    .suggestions-heading {
      font-weight: 700;
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--vscode-textLink-foreground, #3794ff);
      margin-bottom: 6px;
    }
    .suggestions-list {
      margin: 0;
      padding-left: 18px;
    }
    .suggestions-list li {
      margin-bottom: 4px;
      line-height: 1.5;
    }
    .suggestions-list li:last-child {
      margin-bottom: 0;
    }
  </style>
</head>
<body>
  <h2>${escapeHtml(heading)}</h2>
  <p class="meta">${langLabel} · ${modeLabel} ${t(language, "modeSuffix")} · ${result.findings_count} ${findingLabel}${subLabel}</p>
  ${signatureSection}${suggestionsSection}${findingItems}
</body>
</html>`;
  }
}

// ── Private helpers ───────────────────────────────────────────────────────────

function derivePanelTitle(result: AnalysisResult, language: UiLanguage): string {
  if (result.demo_mode) return language === "es" ? "DebugIQ — Demo" : "DebugIQ — Demo";
  if (result.mode === "learn") {
    return language === "es" ? "DebugIQ — Modo Aprendizaje" : "DebugIQ — Learn Mode";
  }
  return language === "es" ? "DebugIQ — Depuracion Rapida" : "DebugIQ — Quick Debug";
}

function renderSignatureSection(info: SignatureInfo, language: UiLanguage): string {
  const shortSig = info.signature.slice(0, 16) + "…";
  const statusLabel = info.status === "new" ? t(language, "signatureNew") : t(language, "signatureRepeated");
  return `<div class="signature-section">
  <span class="sig-label">${t(language, "signatureLabel")}</span>
  <code class="sig-value">${escapeHtml(shortSig)}</code>
  <span class="sig-status sig-${escapeHtml(info.status)}">${escapeHtml(statusLabel)}</span>
</div>
`;
}

function renderSuggestionsSection(suggestions: string[], language: UiLanguage): string {
  const items = suggestions
    .map((s) => `<li>${escapeHtml(s)}</li>`)
    .join("\n    ");
  return `<div class="suggestions-section">
  <div class="suggestions-heading">${t(language, "suggestedNextSteps")}</div>
  <ul class="suggestions-list">
    ${items}
  </ul>
</div>
`;
}

function renderFinding(f: Finding, mode: AnalysisResult["mode"]): string {
  const locationLine =
    f.line_start === f.line_end
      ? `Line ${f.line_start}`
      : `Lines ${f.line_start}–${f.line_end}`;

  const fixBlock = f.fix_hint
    ? `<pre class="fix-hint">${escapeHtml(f.fix_hint)}</pre>`
    : "";

  const explanationBlock =
    f.explanation
      ? `<div class="explanation">${formatExplanation(f.explanation)}</div>`
      : mode === "learn" && f.fix_hint
        ? "" // fix_hint already shown; no explanation means model didn't provide one
        : "";

  return `<div class="finding">
  <div class="finding-header">
    <span class="badge badge-${f.severity}">${escapeHtml(f.severity)}</span>
    <span class="finding-title">${escapeHtml(f.title)}</span>
  </div>
  <div class="finding-location">${locationLine} · ${escapeHtml(f.category)}</div>
  <p class="finding-desc">${escapeHtml(f.description)}</p>
  ${fixBlock}
  ${explanationBlock}
</div>`;
}

function t(language: UiLanguage, key: string): string {
  const table: Record<UiLanguage, Record<string, string>> = {
    en: {
      modeLearn: "Learn",
      modeQuick: "Quick",
      modeSuffix: "mode",
      findingOne: "finding",
      findingMany: "findings",
      headingDemo: "DebugIQ — Demo Results",
      headingLearn: "DebugIQ — Learn Mode",
      headingAnalysis: "DebugIQ — Analysis Results",
      subNoApiKey: " · No API key required",
      signatureLabel: "Bug Signature",
      signatureNew: "New signature",
      signatureRepeated: "Repeated signature",
      suggestedNextSteps: "Suggested next steps",
    },
    es: {
      modeLearn: "Aprendizaje",
      modeQuick: "Rapido",
      modeSuffix: "modo",
      findingOne: "hallazgo",
      findingMany: "hallazgos",
      headingDemo: "DebugIQ — Resultados Demo",
      headingLearn: "DebugIQ — Modo Aprendizaje",
      headingAnalysis: "DebugIQ — Resultados del Analisis",
      subNoApiKey: " · No requiere API key",
      signatureLabel: "Firma de Bug",
      signatureNew: "Firma nueva",
      signatureRepeated: "Firma repetida",
      suggestedNextSteps: "Siguientes pasos sugeridos",
    },
  };

  return table[language][key] ?? table.en[key] ?? key;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Converts a structured explanation string into HTML.
 *
 * Recognises `## Section Name` lines as section headings and renders them
 * with a `.explanation-heading` span. The body text that follows each heading
 * (until the next heading or end of string) is wrapped in a `.explanation-body`
 * paragraph. Falls back to plain escaped text for unstructured explanations.
 */
export function formatExplanation(text: string): string {
  const HEADING_RE = /^##\s+(.+)$/;
  const lines = text.split("\n");

  // Check whether this explanation uses our ## Section headers
  const hasHeadings = lines.some((l) => HEADING_RE.test(l));
  if (!hasHeadings) {
    // Render as plain pre-wrap text — safe fallback for unstructured content
    return `<p class="explanation-body">${escapeHtml(text.trim())}</p>`;
  }

  // Build sections: each heading starts a new section block
  type Section = { heading: string; bodyLines: string[] };
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const line of lines) {
    const m = line.match(HEADING_RE);
    if (m) {
      if (current) sections.push(current);
      current = { heading: m[1], bodyLines: [] };
    } else if (current) {
      current.bodyLines.push(line);
    }
    // lines before the first heading are silently dropped (usually empty)
  }
  if (current) sections.push(current);

  if (sections.length === 0) {
    return `<p class="explanation-body">${escapeHtml(text.trim())}</p>`;
  }

  return sections
    .map(({ heading, bodyLines }) => {
      const body = bodyLines.join("\n").trim();
      return `<div class="explanation-section">
  <span class="explanation-heading">${escapeHtml(heading)}</span>
  <p class="explanation-body">${escapeHtml(body)}</p>
</div>`;
    })
    .join("\n");
}
