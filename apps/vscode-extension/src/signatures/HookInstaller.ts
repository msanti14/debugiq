/**
 * HookInstaller — pure functions for building and patching the pre-commit hook.
 *
 * All logic here is pure (no fs/path/vscode dependency) so it can be tested
 * in isolation. The actual file I/O lives in extension.ts.
 *
 * DebugIQ hook behavior:
 *  - ALWAYS warn-only: exits 0 regardless of findings.
 *  - Reads `.git/debugiq-sig-status.txt` (written by the extension after analysis).
 *  - Prints a soft warning when a new bug signature is detected.
 *  - On any internal failure the subshell exits non-zero, but `|| true` ensures
 *    the outer hook exits 0 — the commit is never blocked.
 */

// ── Markers ───────────────────────────────────────────────────────────────────

export const HOOK_START_MARKER = "# --- DebugIQ:start ---";
export const HOOK_END_MARKER = "# --- DebugIQ:end ---";

// ── Hook script body ──────────────────────────────────────────────────────────
// Note: bash parameter expansions like ${VAR:0:16} are written as \${...} to
// prevent TypeScript from treating them as template-literal interpolations.

const DEBUGIQ_HOOK_BODY = [
  "# DebugIQ warn-only pre-commit check.",
  "# This section is maintained by the DebugIQ VS Code extension.",
  "# It NEVER blocks a commit. Remove this section to disable DebugIQ checks.",
  "(",
  '  _DQ_DIR="$(git rev-parse --git-dir 2>/dev/null)"',
  '  _DQ_STATUS="$_DQ_DIR/debugiq-sig-status.txt"',
  '  if [ -f "$_DQ_STATUS" ]; then',
  "    _DQ_SIG=\"$(grep -o 'signature=[a-f0-9]*' \"$_DQ_STATUS\" 2>/dev/null | cut -d= -f2)\"",
  "    _DQ_STS=\"$(grep -o 'status=[a-z]*' \"$_DQ_STATUS\" 2>/dev/null | cut -d= -f2)\"",
  '    if [ "$_DQ_STS" = "new" ] && [ -n "$_DQ_SIG" ]; then',
  "      printf '[DebugIQ] Warning: new bug signature detected (%s...)\\n' \"${_DQ_SIG:0:16}\" >&2",
  "      printf '[DebugIQ] Tip: run \"DebugIQ: Run Quick Debug\" to review findings.\\n' >&2",
  "    fi",
  "  fi",
  ") || true",
].join("\n").replace("${_DQ_SIG:0:16}", "\${_DQ_SIG:0:16}");

const DEBUGIQ_HOOK_SECTION =
  HOOK_START_MARKER + "\n" + DEBUGIQ_HOOK_BODY + "\n" + HOOK_END_MARKER;

// ── buildHookScript ───────────────────────────────────────────────────────────

/**
 * Produces the final pre-commit hook file content.
 *
 * - `existingContent === null`: creates a new file with a `#!/bin/sh` shebang.
 * - existing file already contains DebugIQ markers: replaces the section
 *   in-place without touching surrounding content.
 * - existing file has no markers: appends the DebugIQ section at the end.
 *
 * The resulting script always exits 0 so it never blocks a commit.
 */
export function buildHookScript(existingContent: string | null): string {
  if (existingContent === null) {
    return "#!/bin/sh\n\n" + DEBUGIQ_HOOK_SECTION + "\n";
  }

  // If DebugIQ markers already exist, replace the section in-place.
  const startIdx = existingContent.indexOf(HOOK_START_MARKER);
  const endIdx = existingContent.indexOf(HOOK_END_MARKER);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = existingContent.slice(0, startIdx);
    const after = existingContent.slice(endIdx + HOOK_END_MARKER.length);
    return before + DEBUGIQ_HOOK_SECTION + after;
  }

  // Append to existing hook that has no DebugIQ section yet.
  const trailingNewline = existingContent.endsWith("\n") ? "\n" : "\n\n";
  return existingContent + trailingNewline + DEBUGIQ_HOOK_SECTION + "\n";
}
