import * as vscode from "vscode";
import { KeychainService } from "./keychain/KeychainService";
import { BackendClient } from "./api/BackendClient";
import { AuthService } from "./auth/AuthService";
import { DemoMode } from "./demo/DemoMode";
import { ModelRouter } from "./analyzer/ModelRouter";
import { SidebarProvider } from "./providers/SidebarProvider";
import type { SupportedLanguage } from "@debugiq/shared-types";

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
  const sidebar = new SidebarProvider();
  const _router = new ModelRouter(); // used in Phase 1 analyzer

  // ── Commands ────────────────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("debugiq.runDemo", () => {
      const languageId =
        vscode.window.activeTextEditor?.document.languageId ?? "";
      const language = mapToSupportedLanguage(languageId);
      const result = demo.getFixture(language, "quick");
      sidebar.show(result);
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
  // Nothing to clean up in Phase 0/1
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Maps a VS Code languageId to a SupportedLanguage.
 * Defaults to "python" for any unrecognised language.
 */
function mapToSupportedLanguage(languageId: string): SupportedLanguage {
  switch (languageId) {
    case "typescript":
    case "typescriptreact":
    case "javascript":
    case "javascriptreact":
      return "typescript";
    case "python":
    default:
      return "python";
  }
}
