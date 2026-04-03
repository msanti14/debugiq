import type * as vscode from "vscode";

/**
 * KeychainService — wraps vscode.SecretStorage.
 *
 * This is the ONLY place in the codebase that reads or writes sensitive values
 * (LLM API keys, JWT tokens). All other modules must go through this service.
 *
 * Security rules:
 * - Values are stored in OS-native secret storage (Keychain / Credential Manager / libsecret).
 * - Values are NEVER written to globalState, workspaceState, or settings.json.
 * - Values are NEVER logged.
 */
export class KeychainService {
  // ── Well-known storage keys (as static props for convenient access) ───────────
  static readonly CLAUDE_API_KEY = "debugiq.claudeApiKey";
  static readonly OPENAI_API_KEY = "debugiq.openaiApiKey";

  private readonly secrets: vscode.SecretStorage;

  constructor(context: { secrets: vscode.SecretStorage }) {
    this.secrets = context.secrets;
  }

  async store(key: string, value: string): Promise<void> {
    await this.secrets.store(key, value);
  }

  async get(key: string): Promise<string | undefined> {
    return this.secrets.get(key);
  }

  async delete(key: string): Promise<void> {
    await this.secrets.delete(key);
  }
}

// ── Well-known storage keys (also exported as a const map for AuthService) ────
// Centralised here so typos cause compile errors, not silent misses.
export const KEYCHAIN_KEYS = {
  ACCESS_TOKEN: "debugiq.accessToken",
  REFRESH_TOKEN: "debugiq.refreshToken",
  CLAUDE_API_KEY: KeychainService.CLAUDE_API_KEY,
  OPENAI_API_KEY: KeychainService.OPENAI_API_KEY,
} as const;
