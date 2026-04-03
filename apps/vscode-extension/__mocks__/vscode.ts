/**
 * Minimal vscode mock for vitest.
 *
 * Maps the "vscode" module alias so tests that import modules using
 * `import * as vscode from 'vscode'` can run outside the VS Code host.
 *
 * Only the symbols used at runtime by QuickAnalyzer (and other tested
 * modules) need to be present here.
 */

export const LanguageModelChatMessage = {
  User: (content: string) => ({ role: "user" as const, content }),
  Assistant: (content: string) => ({ role: "assistant" as const, content }),
};

export class CancellationTokenSource {
  token = {};
  cancel(): void {}
  dispose(): void {}
}

export class LanguageModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LanguageModelError";
  }
}

export const ProgressLocation = {
  Notification: 15,
  SourceControl: 1,
  Window: 10,
};
