/**
 * SignatureStore — workspace-scoped persistence of the last seen bug signature.
 *
 * Uses a `WorkspaceStateStorage` interface (structurally compatible with
 * `vscode.Memento`) so it can be constructed with `context.workspaceState` in
 * the extension and with a plain in-memory map in tests — no vscode host needed.
 *
 * The store is repo-key scoped: each unique `repoKey` (typically the workspace
 * folder path) maintains its own independent last-signature entry.
 */

// ── Interface ─────────────────────────────────────────────────────────────────

/**
 * Minimal storage interface structurally compatible with `vscode.Memento`.
 * Injected in production via `context.workspaceState`.
 */
export interface WorkspaceStateStorage {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): Thenable<void>;
}

// ── SignatureStore ─────────────────────────────────────────────────────────────

export class SignatureStore {
  private static readonly KEY_PREFIX = "debugiq.lastSignature.";

  constructor(private readonly storage: WorkspaceStateStorage) {}

  /**
   * Returns the last stored signature for `repoKey`, or `undefined` if none
   * has been stored yet.
   */
  getLastSignature(repoKey: string): string | undefined {
    return this.storage.get<string>(SignatureStore.KEY_PREFIX + repoKey);
  }

  /**
   * Persists `signature` as the current last-seen signature for `repoKey`.
   */
  async setLastSignature(repoKey: string, signature: string): Promise<void> {
    await this.storage.update(SignatureStore.KEY_PREFIX + repoKey, signature);
  }

  /**
   * Synchronously classifies `signature` relative to the last stored value:
   * - "repeated" if the stored value equals `signature`
   * - "new"      in all other cases (including first-ever store)
   *
   * Does NOT persist the new signature — call `setLastSignature` separately.
   */
  classifySignature(repoKey: string, signature: string): "new" | "repeated" {
    const last = this.getLastSignature(repoKey);
    return last === signature ? "repeated" : "new";
  }
}
