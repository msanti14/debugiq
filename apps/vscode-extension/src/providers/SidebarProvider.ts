import * as vscode from "vscode";
import type { AnalysisResult, Finding } from "@debugiq/shared-types";

/**
 * SidebarProvider manages the DebugIQ webview panel.
 *
 * - `show(result)` creates the panel on first call and reveals it on subsequent calls.
 *   The panel title updates on every call to reflect the current analysis mode.
 * - `renderHtml(result)` is a pure static method — usable in tests without a vscode context.
 */
export class SidebarProvider {
  private panel: vscode.WebviewPanel | undefined;

  show(result: AnalysisResult): void {
    const panelTitle = derivePanelTitle(result);

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

    this.panel.webview.html = SidebarProvider.renderHtml(result);
  }

  /**
   * Pure static renderer — no vscode dependency, fully testable.
   * Findings are sorted by severity (critical → high → medium → low → info).
   */
  static renderHtml(result: AnalysisResult): string {
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

    const modeLabel = result.mode === "learn" ? "Learn" : "Quick";
    const langLabel =
      result.language.charAt(0).toUpperCase() + result.language.slice(1);

    const heading = result.demo_mode
      ? "DebugIQ — Demo Results"
      : result.mode === "learn"
        ? "DebugIQ — Learn Mode"
        : "DebugIQ — Analysis Results";

    const subLabel = result.demo_mode ? " · No API key required" : "";

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
  </style>
</head>
<body>
  <h2>${escapeHtml(heading)}</h2>
  <p class="meta">${langLabel} · ${modeLabel} mode · ${result.findings_count} finding${result.findings_count !== 1 ? "s" : ""}${subLabel}</p>
  ${findingItems}
</body>
</html>`;
  }
}

// ── Private helpers ───────────────────────────────────────────────────────────

function derivePanelTitle(result: AnalysisResult): string {
  if (result.demo_mode) return "DebugIQ — Demo";
  return result.mode === "learn" ? "DebugIQ — Learn Mode" : "DebugIQ — Quick Debug";
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
