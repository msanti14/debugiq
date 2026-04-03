import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildPrompt,
  parseResponse,
  computeCodeHash,
  analyze,
} from "../src/analyzer/QuickAnalyzer";

// ── buildPrompt ───────────────────────────────────────────────────────────────

describe("buildPrompt()", () => {
  it("returns an array of exactly 2 messages", () => {
    const messages = buildPrompt("print('hello')", "python");
    expect(messages).toHaveLength(2);
  });

  it("combined message content includes the language name", () => {
    const messages = buildPrompt("const x = null;", "typescript");
    const allText = messages.map((m) => m.content).join(" ");
    expect(allText).toContain("typescript");
  });

  it("second message (User) content includes the verbatim code string", () => {
    const code = "SELECT * FROM users WHERE id = " + "'" + "abc" + "'";
    const messages = buildPrompt(code, "python");
    expect(messages[1].content).toContain(code);
  });

  it("combined message text includes the word 'JSON' (case-insensitive)", () => {
    const messages = buildPrompt("x = 1", "python");
    const allText = messages.map((m) => m.content).join(" ");
    expect(allText.toLowerCase()).toContain("json");
  });
});

// ── parseResponse ─────────────────────────────────────────────────────────────

const VALID_FINDING_JSON =
  '[{"id":"1","category":"sql_injection","severity":"critical","title":"T",' +
  '"description":"D","line_start":1,"line_end":1,"fix_hint":"F"}]';

describe("parseResponse()", () => {
  it("parses a plain JSON array string", () => {
    const findings = parseResponse(VALID_FINDING_JSON);
    expect(findings).toHaveLength(1);
    expect(findings[0].category).toBe("sql_injection");
    expect(findings[0].severity).toBe("critical");
  });

  it("parses JSON wrapped in a triple-backtick json fence", () => {
    const fenced = "```json\n" + VALID_FINDING_JSON + "\n```";
    const findings = parseResponse(fenced);
    expect(findings).toHaveLength(1);
    expect(findings[0].category).toBe("sql_injection");
  });

  it("parses JSON wrapped in a plain triple-backtick fence (no language tag)", () => {
    const fenced = "```\n" + VALID_FINDING_JSON + "\n```";
    const findings = parseResponse(fenced);
    expect(findings).toHaveLength(1);
    expect(findings[0].category).toBe("sql_injection");
  });

  it("throws on empty string", () => {
    expect(() => parseResponse("")).toThrow("Empty LLM response");
  });

  it("throws on plain prose text with no JSON array", () => {
    expect(() => parseResponse("Sorry, I cannot analyze this code.")).toThrow(
      "No JSON array found in response",
    );
  });

  it("returns findings with id field populated even when source JSON omits it", () => {
    const noId =
      '[{"category":"sql_injection","severity":"critical","title":"T",' +
      '"description":"D","line_start":1,"line_end":1,"fix_hint":"F"}]';
    const findings = parseResponse(noId);
    expect(findings[0].id).toBeTruthy();
    expect(typeof findings[0].id).toBe("string");
  });
});

// ── computeCodeHash ───────────────────────────────────────────────────────────

describe("computeCodeHash()", () => {
  it("returns a string of length 64", () => {
    expect(computeCodeHash("hello")).toHaveLength(64);
  });

  it("matches the /^[a-f0-9]{64}$/ pattern", () => {
    expect(computeCodeHash("hello")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is deterministic — same input always returns the same hash", () => {
    const code = "def foo(): pass";
    expect(computeCodeHash(code)).toBe(computeCodeHash(code));
  });

  it("produces different hashes for different inputs", () => {
    expect(computeCodeHash("abc")).not.toBe(computeCodeHash("xyz"));
  });
});

// ── analyze() ─────────────────────────────────────────────────────────────────

const FAKE_PAYLOAD =
  '[{"id":"abc","category":"sql_injection","severity":"critical",' +
  '"title":"SQL Injection found","description":"Unparameterized query",' +
  '"line_start":3,"line_end":3,"fix_hint":"Use parameterized queries"}]';

function makeMockModel() {
  return {
    name: "copilot-gpt-4o",
    id: "copilot-gpt-4o",
    sendRequest: vi.fn().mockResolvedValue({
      // text: AsyncIterable<string> — yields the full payload in one chunk
      text: (async function* () {
        yield FAKE_PAYLOAD;
      })(),
    }),
  } as unknown as import("vscode").LanguageModelChat;
}

describe("analyze()", () => {
  const TEST_CODE = "cursor.execute('SELECT * FROM users WHERE id = ' + user_id)";

  it("result.demo_mode is false", async () => {
    const result = await analyze(TEST_CODE, "python", makeMockModel());
    expect(result.demo_mode).toBe(false);
  });

  it("result.mode is 'quick'", async () => {
    const result = await analyze(TEST_CODE, "python", makeMockModel());
    expect(result.mode).toBe("quick");
  });

  it("result.findings_count equals result.findings.length", async () => {
    const result = await analyze(TEST_CODE, "python", makeMockModel());
    expect(result.findings_count).toBe(result.findings.length);
  });

  it("result.code_hash equals computeCodeHash(code)", async () => {
    const result = await analyze(TEST_CODE, "python", makeMockModel());
    expect(result.code_hash).toBe(computeCodeHash(TEST_CODE));
  });
});
