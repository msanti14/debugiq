import * as vscode from "vscode";
import { KeychainService } from "./keychain/KeychainService";
import { BackendClient } from "./api/BackendClient";
import { AuthService } from "./auth/AuthService";
import { DemoMode } from "./demo/DemoMode";
import { ModelRouter } from "./analyzer/ModelRouter";
import { SidebarProvider } from "./providers/SidebarProvider";
import { analyze } from "./analyzer/QuickAnalyzer";
import type { SupportedLanguage, SaveResultRequest, SaveResultResponse } from "@debugiq/shared-types";

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
  const modelRouter = new ModelRouter();

  // ── Commands ────────────────────────────────────────────────────────────────

  // Demo mode — always works, no API key or Copilot required
  context.subscriptions.push(
    vscode.commands.registerCommand("debugiq.runDemo", () => {
      const languageId =
        vscode.window.activeTextEditor?.document.languageId ?? "";
      const language = mapToSupportedLanguage(languageId);
      const result = demo.getFixture(language, "quick");
      sidebar.show(result);
    }),
  );

  // Quick Debug — uses GitHub Copilot via vscode.lm; falls back to demo if unavailable
  context.subscriptions.push(
    vscode.commands.registerCommand("debugiq.runQuickDebug", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("Open a file first");
        return;
      }
      const selectedCode = editor.document.getText(editor.selection);
      if (!selectedCode.trim()) {
        vscode.window.showWarningMessage("Select code to analyze");
        return;
      }
      const language = mapToSupportedLanguage(editor.document.languageId);
      const models = await vscode.lm.selectChatModels(
        modelRouter.toLmSelector("quick", language),
      );
      if (models.length === 0) {
        vscode.window.showInformationMessage(
          "GitHub Copilot not available. Showing demo result.",
        );
        sidebar.show(demo.getFixture(language, "quick"));
        return;
      }
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "DebugIQ: Analyzing…",
          cancellable: false,
        },
        async () => {
          try {
            const result = await analyze(selectedCode, language, models[0]);
            sidebar.show(result);
            // Auto-save: fire-and-forget; never block UX
            if (await auth.isLoggedIn()) {
              const payload: SaveResultRequest = {
                language: result.language,
                mode: result.mode,
                code_hash: result.code_hash,
                findings: result.findings,
                model_used: result.model_used,
                duration_ms: result.duration_ms ?? 0,
                demo_mode: result.demo_mode,
                analyzed_at: result.analyzed_at,
              };
              client.post<SaveResultResponse>("/results", payload).catch(() => {});
            }
          } catch (e) {
            if (e instanceof vscode.LanguageModelError) {
              vscode.window.showErrorMessage("Copilot error: " + e.message);
            } else {
              throw e;
            }
          }
        },
      );
    }),
  );

  // Set API Key — stores Claude or OpenAI key in OS keychain (Phase 3 BYOK scaffold)
  context.subscriptions.push(
    vscode.commands.registerCommand("debugiq.setApiKey", async () => {
      const provider = await vscode.window.showQuickPick(
        ["Claude (Anthropic)", "OpenAI (GPT-4o)"],
        { placeHolder: "Select API key provider" },
      );
      if (!provider) return;
      const key = await vscode.window.showInputBox({
        prompt: "Enter your API key",
        password: true,
        ignoreFocusOut: true,
      });
      if (!key) return;
      const keyName = provider.startsWith("Claude")
        ? KeychainService.CLAUDE_API_KEY
        : KeychainService.OPENAI_API_KEY;
      await keychain.store(keyName, key);
      vscode.window.showInformationMessage("API key saved securely in OS keychain");
    }),
  );

  // Clear API Key
  context.subscriptions.push(
    vscode.commands.registerCommand("debugiq.clearApiKey", async () => {
      const target = await vscode.window.showQuickPick(
        ["Claude (Anthropic)", "OpenAI (GPT-4o)", "Both"],
        { placeHolder: "Which key to clear?" },
      );
      if (!target) return;
      const confirmed = await vscode.window.showWarningMessage(
        "Clear " + target + " API key?",
        { modal: true },
        "Clear",
      );
      if (confirmed !== "Clear") return;
      if (target === "Claude (Anthropic)" || target === "Both") {
        await keychain.delete(KeychainService.CLAUDE_API_KEY);
      }
      if (target === "OpenAI (GPT-4o)" || target === "Both") {
        await keychain.delete(KeychainService.OPENAI_API_KEY);
      }
      vscode.window.showInformationMessage("API key cleared");
    }),
  );

  // Login / logout
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
  // Nothing to clean up in Phase 1/2
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
