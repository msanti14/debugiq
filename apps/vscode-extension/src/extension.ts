import * as vscode from "vscode";
import { KeychainService } from "./keychain/KeychainService";
import { BackendClient } from "./api/BackendClient";
import { AuthService } from "./auth/AuthService";
import { DemoMode } from "./demo/DemoMode";
import { ModelRouter } from "./analyzer/ModelRouter";

// API_BASE_URL is injected at build time from the API_BASE_URL environment variable.
// In Phase 0 this is the Railway-generated URL. Developers can override via
// the `debugiq.apiBaseUrl` VS Code setting for local development.
declare const API_BASE_URL: string;

export function activate(context: vscode.ExtensionContext): void {
  // ── Service wiring ──────────────────────────────────────────────────────────
  const configuredUrl =
    vscode.workspace.getConfiguration("debugiq").get<string>("apiBaseUrl") ||
    API_BASE_URL ||
    "http://localhost:8000";

  const keychain = new KeychainService(context);
  const client = new BackendClient(configuredUrl);
  const auth = new AuthService(keychain, client);
  client.setAuth(auth);

  const demo = new DemoMode();
  const _router = new ModelRouter(); // used in Phase 1 analyzer

  // ── Commands ────────────────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("debugiq.runDemo", () => {
      const fixtures = demo.getFixtures();
      const panel = vscode.window.createWebviewPanel(
        "debugiqDemo",
        "DebugIQ — Demo",
        vscode.ViewColumn.Beside,
        { enableScripts: false },
      );
      panel.webview.html = renderDemoHtml(fixtures);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("debugiq.login", async () => {
      const email = await vscode.window.showInputBox({ prompt: "Email", ignoreFocusOut: true });
      if (!email) return;
      const password = await vscode.window.showInputBox({
        prompt: "Password",
        password: true,
        ignoreFocusOut: true,
      });
      if (!password) return;

      try {
        await auth.login(email, password);
        vscode.window.showInformationMessage("DebugIQ: logged in successfully.");
      } catch (err) {
        vscode.window.showErrorMessage(`DebugIQ: login failed — ${String(err)}`);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("debugiq.logout", async () => {
      await auth.logout();
      vscode.window.showInformationMessage("DebugIQ: logged out.");
    }),
  );
}

export function deactivate(): void {
  // Nothing to clean up in Phase 0
}

// ── Demo renderer (minimal, no external dependencies) ─────────────────────────
function renderDemoHtml(fixtures: ReturnType<DemoMode["getFixtures"]>): string {
  const items = fixtures
    .flatMap((r) => r.findings)
    .map(
      (f) =>
        `<li><strong>[${f.severity.toUpperCase()}] ${f.title}</strong><br/>
         <em>Line ${f.line_start}</em> · ${f.category}<br/>
         ${f.description}<br/>
         ${f.fix_hint ? `<code>${f.fix_hint}</code>` : ""}
         ${f.explanation ? `<details><summary>Learn more</summary><p>${f.explanation}</p></details>` : ""}
         </li>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>DebugIQ Demo</title>
<style>body{font-family:sans-serif;padding:16px}li{margin-bottom:16px}code{background:#f4f4f4;padding:2px 4px}</style>
</head>
<body>
<h2>DebugIQ — Demo Results</h2>
<p>These are example findings from AI-generated code. No API key required.</p>
<ul>${items}</ul>
</body></html>`;
}
