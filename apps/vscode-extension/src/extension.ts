import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { KeychainService } from "./keychain/KeychainService";
import { BackendClient } from "./api/BackendClient";
import { AuthService } from "./auth/AuthService";
import { DemoMode } from "./demo/DemoMode";
import { ModelRouter } from "./analyzer/ModelRouter";
import { SidebarProvider } from "./providers/SidebarProvider";
import { analyze } from "./analyzer/QuickAnalyzer";
import { analyzeLearn } from "./analyzer/LearnAnalyzer";
import { normalizeFindingsForSignature, computeBugSignature } from "./analyzer/BugSignature";
import { SignatureStore } from "./signatures/SignatureStore";
import { buildHookScript } from "./signatures/HookInstaller";
import { evaluateSignatureRules, highestSeverity } from "./signatures/SignatureRules";
import { resolveUiLanguage, type UiLanguage } from "./i18n";
import type { SupportedLanguage, SaveResultRequest, SaveResultResponse, AnalysisResult } from "@debugiq/shared-types";
import type { PostAnalyticsEventRequest } from "@debugiq/shared-types";
import type { SignatureInfo } from "./providers/SidebarProvider";

// API_BASE_URL may be injected at build time by a bundler (e.g. esbuild define).
// At runtime in a plain tsc build the symbol is absent, so we read it safely
// from globalThis to avoid a ReferenceError on activation.
const injectedApiBaseUrl: string =
  typeof globalThis === "object" &&
  typeof (globalThis as { API_BASE_URL?: unknown }).API_BASE_URL === "string"
    ? ((globalThis as { API_BASE_URL?: string }).API_BASE_URL ?? "")
    : "";

export function activate(context: vscode.ExtensionContext): void {
  const configuredOutputLanguage =
    vscode.workspace.getConfiguration("debugiq").get<"auto" | UiLanguage>("outputLanguage") ?? "auto";
  const uiLanguage = resolveUiLanguage(configuredOutputLanguage, vscode.env.language);
  const t = (en: string, es: string): string => (uiLanguage === "es" ? es : en);

  // ── First-run onboarding ─────────────────────────────────────────────────────
  const firstRunKey = "debugiq.firstRunShown";
  if (!context.globalState.get<boolean>(firstRunKey)) {
    context.globalState.update(firstRunKey, true);
    vscode.window
      .showInformationMessage(
        t(
          "Welcome to DebugIQ! Three ways to debug: Demo (no setup), Quick Debug (Copilot), Learn Debug (Copilot + explanations). No API keys needed.",
          "Bienvenido a DebugIQ. Tienes tres formas de depurar: Demo (sin configuracion), Quick Debug (Copilot) y Learn Debug (Copilot + explicaciones). No necesitas API keys.",
        ),
        t("Run Demo", "Ejecutar Demo"),
        t("Show Commands", "Ver Comandos"),
      )
      .then((choice) => {
        if (choice === "Run Demo" || choice === "Ejecutar Demo") {
          vscode.commands.executeCommand("debugiq.runDemo");
        } else if (choice === "Show Commands" || choice === "Ver Comandos") {
          vscode.commands.executeCommand("workbench.action.quickOpen", ">DebugIQ ");
        }
      });
  }

  // ── Service wiring ──────────────────────────────────────────────────────────
  const configuredUrl =
    vscode.workspace.getConfiguration("debugiq").get<string>("apiBaseUrl") ||
    injectedApiBaseUrl ||
    "http://localhost:8000";

  const sigEnabled =
    vscode.workspace.getConfiguration("debugiq").get<boolean>("signature.enabled") ?? true;
  const sigSensitivity =
    vscode.workspace.getConfiguration("debugiq").get<"strict" | "balanced">("signature.sensitivity") ?? "balanced";
  const hookWarnOn =
    vscode.workspace.getConfiguration("debugiq").get<"new-signature" | "new-or-critical">("hook.warnOn") ?? "new-signature";

  const keychain = new KeychainService(context);
  const client = new BackendClient(configuredUrl);
  const auth = new AuthService(keychain, client);
  client.setAuth(auth);

  const demo = new DemoMode();
  const sidebar = new SidebarProvider();
  const modelRouter = new ModelRouter();
  const signatureStore = new SignatureStore(context.workspaceState);

  // ── Commands ────────────────────────────────────────────────────────────────

  // Demo mode — always works, no API key or Copilot required
  context.subscriptions.push(
    vscode.commands.registerCommand("debugiq.runDemo", () => {
      const languageId =
        vscode.window.activeTextEditor?.document.languageId ?? "";
      const language = mapToSupportedLanguage(languageId);
      const result = demo.getFixture(language, "quick");
      sidebar.show(result, undefined, undefined, uiLanguage);
    }),
  );

  // Quick Debug — uses GitHub Copilot via vscode.lm; falls back to demo if unavailable
  context.subscriptions.push(
    vscode.commands.registerCommand("debugiq.runQuickDebug", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage(
          t(
            "DebugIQ: Open a file in the editor first, then run Quick Debug.",
            "DebugIQ: Abre un archivo en el editor y luego ejecuta Quick Debug.",
          ),
        );
        return;
      }
      const selectedCode = editor.document.getText(editor.selection);
      if (!selectedCode.trim()) {
        vscode.window.showWarningMessage(
          t(
            "DebugIQ: Select some code in the editor first.",
            "DebugIQ: Selecciona codigo en el editor primero.",
          ),
        );
        return;
      }
      const language = mapToSupportedLanguage(editor.document.languageId);
      const model = await selectCopilotModel(modelRouter, "quick", language);
      if (!model) {
        vscode.window.showInformationMessage(
          t(
            "DebugIQ: GitHub Copilot is not available — install or sign in to Copilot to use AI analysis. Showing demo result.",
            "DebugIQ: GitHub Copilot no esta disponible. Instala o inicia sesion en Copilot para usar analisis con IA. Mostrando resultado demo.",
          ),
        );
        sidebar.show(demo.getFixture(language, "quick"), undefined, undefined, uiLanguage);
        return;
      }
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: t("DebugIQ: Analyzing...", "DebugIQ: Analizando..."),
          cancellable: false,
        },
        async () => {
          try {
            const result = await analyze(selectedCode, language, model, uiLanguage);
            const { signatureInfo, suggestions } = computeAndStoreSignature(result, signatureStore, sigEnabled, sigSensitivity, hookWarnOn, uiLanguage);
            sidebar.show(result, signatureInfo, suggestions, uiLanguage);
            autoSave(result, auth, client);
            fireAnalyticsEvent(result, signatureInfo, auth, client);
          } catch (e) {
            if (e instanceof vscode.LanguageModelError) {
              vscode.window.showErrorMessage(t("DebugIQ: Copilot error - ", "DebugIQ: Error de Copilot - ") + e.message);
            } else {
              vscode.window.showErrorMessage(
                t(
                  "DebugIQ: Analysis failed unexpectedly. Please try again.",
                  "DebugIQ: El analisis fallo de forma inesperada. Intenta de nuevo.",
                ),
              );
            }
          }
        },
      );
    }),
  );

  // Learn Debug — uses GitHub Copilot via vscode.lm; falls back to demo if unavailable
  context.subscriptions.push(
    vscode.commands.registerCommand("debugiq.runLearnDebug", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage(
          t(
            "DebugIQ: Open a file in the editor first, then run Learn Debug.",
            "DebugIQ: Abre un archivo en el editor y luego ejecuta Learn Debug.",
          ),
        );
        return;
      }
      const selectedCode = editor.document.getText(editor.selection);
      if (!selectedCode.trim()) {
        vscode.window.showWarningMessage(
          t(
            "DebugIQ: Select some code in the editor first.",
            "DebugIQ: Selecciona codigo en el editor primero.",
          ),
        );
        return;
      }
      const language = mapToSupportedLanguage(editor.document.languageId);
      const model = await selectCopilotModel(modelRouter, "learn", language);
      if (!model) {
        vscode.window.showInformationMessage(
          t(
            "DebugIQ: GitHub Copilot is not available — install or sign in to Copilot to use AI analysis. Showing demo result.",
            "DebugIQ: GitHub Copilot no esta disponible. Instala o inicia sesion en Copilot para usar analisis con IA. Mostrando resultado demo.",
          ),
        );
        sidebar.show(demo.getFixture(language, "learn"), undefined, undefined, uiLanguage);
        return;
      }
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: t("DebugIQ: Teaching through this bug...", "DebugIQ: Ensenando a traves de este bug..."),
          cancellable: false,
        },
        async () => {
          try {
            const result = await analyzeLearn(selectedCode, language, model, uiLanguage);
            const { signatureInfo, suggestions } = computeAndStoreSignature(result, signatureStore, sigEnabled, sigSensitivity, hookWarnOn, uiLanguage);
            sidebar.show(result, signatureInfo, suggestions, uiLanguage);
            autoSave(result, auth, client);
            fireAnalyticsEvent(result, signatureInfo, auth, client);
          } catch (e) {
            if (e instanceof vscode.LanguageModelError) {
              vscode.window.showErrorMessage(t("DebugIQ: Copilot error - ", "DebugIQ: Error de Copilot - ") + e.message);
            } else {
              vscode.window.showErrorMessage(
                t(
                  "DebugIQ: Analysis failed unexpectedly. Please try again.",
                  "DebugIQ: El analisis fallo de forma inesperada. Intenta de nuevo.",
                ),
              );
            }
          }
        },
      );
    }),
  );

  // Install Pre-Commit Hook — creates a warn-only .git/hooks/pre-commit
  context.subscriptions.push(
    vscode.commands.registerCommand("debugiq.installPreCommitHook", async () => {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders?.length) {
        vscode.window.showWarningMessage(
          t(
            "DebugIQ: No workspace folder open.",
            "DebugIQ: No hay una carpeta de workspace abierta.",
          ),
        );
        return;
      }
      const root = folders[0].uri.fsPath;
      const hooksDir = path.join(root, ".git", "hooks");
      if (!fs.existsSync(hooksDir)) {
        vscode.window.showErrorMessage(
          t(
            "DebugIQ: No .git/hooks directory found. Is this a git repository?",
            "DebugIQ: No se encontro el directorio .git/hooks. Es este un repositorio git?",
          ),
        );
        return;
      }
      const hookPath = path.join(hooksDir, "pre-commit");
      let existingContent: string | null = null;
      try {
        existingContent = fs.readFileSync(hookPath, "utf8");
      } catch {
        // File doesn't exist yet — that's fine
      }
      const newContent = buildHookScript(existingContent);
      try {
        fs.writeFileSync(hookPath, newContent, "utf8");
      } catch (writeErr) {
        vscode.window.showErrorMessage(
          t(
            `DebugIQ: Could not write hook file - ${String(writeErr)}. Check file permissions.`,
            `DebugIQ: No se pudo escribir el hook - ${String(writeErr)}. Revisa permisos de archivo.`,
          ),
        );
        return;
      }
      try {
        fs.chmodSync(hookPath, 0o755);
      } catch {
        // chmod not supported on all platforms (e.g. Windows) — ignore
      }
      vscode.window.showInformationMessage(
        t(
          "DebugIQ: Pre-commit hook installed (warn-only). It will never block a commit.",
          "DebugIQ: Hook pre-commit instalado (solo advertencias). Nunca bloqueara un commit.",
        ),
      );
    }),
  );

  // Set API Key — stores Claude or OpenAI key in OS keychain (Phase 3 BYOK scaffold)
  context.subscriptions.push(
    vscode.commands.registerCommand("debugiq.setApiKey", async () => {
      const provider = await vscode.window.showQuickPick(
        ["Claude (Anthropic)", "OpenAI (GPT-4o)"],
        { placeHolder: t("Select API key provider", "Selecciona proveedor de API key") },
      );
      if (!provider) return;
      const key = await vscode.window.showInputBox({
        prompt: t("Enter your API key", "Ingresa tu API key"),
        password: true,
        ignoreFocusOut: true,
      });
      if (!key) return;
      const keyName = provider.startsWith("Claude")
        ? KeychainService.CLAUDE_API_KEY
        : KeychainService.OPENAI_API_KEY;
      await keychain.store(keyName, key);
      vscode.window.showInformationMessage(
        t(
          "API key saved securely in OS keychain",
          "API key guardada de forma segura en el llavero del sistema",
        ),
      );
    }),
  );

  // Clear API Key
  context.subscriptions.push(
    vscode.commands.registerCommand("debugiq.clearApiKey", async () => {
      const target = await vscode.window.showQuickPick(
        ["Claude (Anthropic)", "OpenAI (GPT-4o)", "Both"],
        { placeHolder: t("Which key to clear?", "Que clave quieres borrar?") },
      );
      if (!target) return;
      const confirmed = await vscode.window.showWarningMessage(
        t("Clear ", "Borrar ") + target + t(" API key?", " API key?"),
        { modal: true },
        t("Clear", "Borrar"),
      );
      if (confirmed !== "Clear" && confirmed !== "Borrar") return;
      if (target === "Claude (Anthropic)" || target === "Both") {
        await keychain.delete(KeychainService.CLAUDE_API_KEY);
      }
      if (target === "OpenAI (GPT-4o)" || target === "Both") {
        await keychain.delete(KeychainService.OPENAI_API_KEY);
      }
      vscode.window.showInformationMessage(t("API key cleared", "API key borrada"));
    }),
  );

  // Login / logout
  context.subscriptions.push(
    vscode.commands.registerCommand("debugiq.login", async () => {
      const email = await vscode.window.showInputBox({ prompt: t("Email", "Correo"), ignoreFocusOut: true });
      if (!email) return;
      const password = await vscode.window.showInputBox({
        prompt: t("Password", "Contrasena"),
        password: true,
        ignoreFocusOut: true,
      });
      if (!password) return;

      try {
        await auth.login(email, password);
        vscode.window.showInformationMessage(t("DebugIQ: logged in successfully.", "DebugIQ: sesion iniciada correctamente."));
      } catch (err) {
        vscode.window.showErrorMessage(
          t(
            `DebugIQ: login failed - ${String(err)}`,
            `DebugIQ: fallo de inicio de sesion - ${String(err)}`,
          ),
        );
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("debugiq.logout", async () => {
      try {
        await auth.logout();
        vscode.window.showInformationMessage(t("DebugIQ: logged out.", "DebugIQ: sesion cerrada."));
      } catch {
        vscode.window.showInformationMessage(t("DebugIQ: logged out.", "DebugIQ: sesion cerrada."));
      }
    }),
  );
}

export function deactivate(): void {
  // Nothing to clean up
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

/**
 * Computes the bug signature for `result`, classifies it as new/repeated using
 * `signatureStore`, persists the latest signature (fire-and-forget), writes
 * the status file in `.git/` for the pre-commit hook to consume, and evaluates
 * signature rules to produce team-insight suggestions.
 *
 * Returns a `{ signatureInfo, suggestions }` tuple for the sidebar to display.
 */
function computeAndStoreSignature(
  result: AnalysisResult,
  signatureStore: SignatureStore,
  sigEnabled: boolean,
  sensitivity: "strict" | "balanced",
  hookWarnOn: "new-signature" | "new-or-critical",
  language: UiLanguage,
): { signatureInfo: SignatureInfo | undefined; suggestions: string[] } {
  if (!sigEnabled) {
    return { signatureInfo: undefined, suggestions: [] };
  }
  const repoKey =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "__no-workspace__";
  const sigInput = normalizeFindingsForSignature(
    result.findings,
    result.language,
    result.mode,
  );
  const signature = computeBugSignature(sigInput);
  const status = signatureStore.classifySignature(repoKey, signature);
  // Fire-and-forget: persist latest signature; never block UX
  signatureStore.setLastSignature(repoKey, signature).catch(() => {});

  const sevs = result.findings.map((f) => f.severity);
  const topSev = highestSeverity(sevs) ?? "none";
  // Write status file for pre-commit hook consumption (fire-and-forget)
  writeSignatureStatusFile(repoKey, signature, status, topSev, hookWarnOn);

  const suggestions = evaluateSignatureRules({
    status,
    mode: result.mode,
    highestSeverity: highestSeverity(sevs),
    sensitivity,
    language,
  });

  return { signatureInfo: { signature, status }, suggestions };
}

/**
 * Writes `.git/debugiq-sig-status.txt` in the workspace git root so the
 * pre-commit hook can read it. Includes severity and warn_on so the hook can
 * apply the correct warning policy. Completely fire-and-forget — any I/O
 * error is silently swallowed so analysis UX is never blocked.
 */
function writeSignatureStatusFile(
  workspaceRoot: string,
  signature: string,
  status: "new" | "repeated",
  severity: string,
  warnOn: "new-signature" | "new-or-critical",
): void {
  try {
    const gitDir = path.join(workspaceRoot, ".git");
    if (!fs.existsSync(gitDir)) return;
    const statusFile = path.join(gitDir, "debugiq-sig-status.txt");
    fs.writeFileSync(
      statusFile,
      `signature=${signature}\nstatus=${status}\nseverity=${severity}\nwarn_on=${warnOn}\n`,
      "utf8",
    );
  } catch {
    // Fire-and-forget — never block UX
  }
}

/**
 * Auto-saves an analysis result to the backend when the user is logged in.
 * Completely fire-and-forget — never blocks UX or throws.
 */
function autoSave(
  result: AnalysisResult,
  auth: AuthService,
  client: BackendClient,
): void {
  auth.isLoggedIn().then((loggedIn) => {
    if (!loggedIn) return;
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
  }).catch(() => {});
}

/**
 * Fires a `signature_generated` or `signature_repeated` analytics event when
 * the user is logged in. Completely fire-and-forget.
 */
function fireAnalyticsEvent(
  result: AnalysisResult,
  signatureInfo: SignatureInfo | undefined,
  auth: AuthService,
  client: BackendClient,
): void {
  if (!signatureInfo) return;
  auth.isLoggedIn().then((loggedIn) => {
    if (!loggedIn) return;
    const repoKey =
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "__no-workspace__";
    const sevs = result.findings.map((f) => f.severity);
    const topSev = highestSeverity(sevs);
    const eventType =
      signatureInfo.status === "new" ? "signature_generated" : "signature_repeated";
    const payload: PostAnalyticsEventRequest = {
      event_type: eventType,
      properties: {
        signature_hash: signatureInfo.signature,
        status: signatureInfo.status,
        severity_summary: topSev ?? "none",
        mode: result.mode,
        language: result.language,
        repo_key_hash: createHash("sha256").update(repoKey, "utf8").digest("hex"), // hash, never raw path
      },
    };
    client.post<{ event_id: string }>("/analytics/events", payload).catch(() => {});
  }).catch(() => {});
}

async function selectCopilotModel(
  modelRouter: ModelRouter,
  mode: "quick" | "learn",
  language: SupportedLanguage,
): Promise<vscode.LanguageModelChat | undefined> {
  const strictMatches = await vscode.lm.selectChatModels(
    modelRouter.toLmSelector(mode, language),
  );
  if (strictMatches.length > 0) {
    return strictMatches[0];
  }

  // Fallback: some accounts expose Copilot model families with different IDs.
  const anyCopilot = await vscode.lm.selectChatModels({ vendor: "copilot" });
  if (anyCopilot.length === 0) {
    return undefined;
  }

  const preferred = anyCopilot.find((m) => {
    const id = (m.id ?? "").toLowerCase();
    const name = (m.name ?? "").toLowerCase();
    const text = `${id} ${name}`;
    return mode === "learn"
      ? text.includes("claude") || text.includes("sonnet")
      : text.includes("gpt") || text.includes("o1") || text.includes("o3");
  });

  return preferred ?? anyCopilot[0];
}
