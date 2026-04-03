import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildLearnPrompt,
  parseLearnResponse,
  analyzeLearn,
} from "../src/analyzer/LearnAnalyzer";
import { computeCodeHash } from "../src/analyzer/QuickAnalyzer";

// ── buildLearnPrompt ──────────────────────────────────────────────────────────

describe("buildLearnPrompt()", () => {
  const CODE = "except:\n    pass";

  it("returns exactly 2 messages", () => {
    expect(buildLearnPrompt(CODE, "python")).toHaveLength(2);
  });

  it("includes the language name in the combined message text", () => {
    const messages = buildLearnPrompt(CODE, "typescript");
    const allText = messages.map((m) => m.content).join(" ");
    expect(allText).toContain("typescript");
  });

  it("second message contains the verbatim code string", () => {
    const messages = buildLearnPrompt(CODE, "python");
    expect(messages[1].content).toContain(CODE);
  });

  it("combined text mentions JSON output requirement", () => {
    const messages = buildLearnPrompt(CODE, "python");
    const allText = messages.map((m) => m.content).join(" ");
    expect(allText.toLowerCase()).toContain("json");
  });

  it("system message mentions the 'What' explanation section", () => {
    const messages = buildLearnPrompt(CODE, "python");
    expect(messages[0].content).toContain("What");
  });

  it("system message mentions the 'Why it is wrong' explanation section", () => {
    const messages = buildLearnPrompt(CODE, "python");
    expect(messages[0].content).toContain("Why it is wrong");
  });

  it("system message mentions the 'What could fail' explanation section", () => {
    const messages = buildLearnPrompt(CODE, "python");
    expect(messages[0].content).toContain("What could fail");
  });

  it("system message mentions the 'Exercise' explanation section", () => {
    const messages = buildLearnPrompt(CODE, "python");
    expect(messages[0].content).toContain("Exercise");
  });
});

// ── parseLearnResponse ────────────────────────────────────────────────────────

const EXPLANATION =
  "## What\nBare except.\n\n## Why it is wrong\nCatches everything.\n\n" +
  "## What could fail\nKeyboardInterrupt swallowed.\n\n## Exercise\nRewrite it.";

const VALID_LEARN_JSON =
  '[{"id":"f-001","category":"bare_exception","severity":"medium",' +
  '"title":"Bare except","description":"Catches all exceptions.",' +
  '"line_start":2,"line_end":2,"fix_hint":"Use except Exception as e:",' +
  '"explanation":"' +
  EXPLANATION.replace(/\n/g, "\\n").replace(/"/g, '\\"') +
  '"}]';

describe("parseLearnResponse()", () => {
  it("parses a plain JSON array with explanation", () => {
    const findings = parseLearnResponse(VALID_LEARN_JSON);
    expect(findings).toHaveLength(1);
    expect(findings[0].category).toBe("bare_exception");
    expect(findings[0].explanation).toBeTruthy();
  });

  it("parses JSON wrapped in a triple-backtick json fence", () => {
    const fenced = "```json\n" + VALID_LEARN_JSON + "\n```";
    const findings = parseLearnResponse(fenced);
    expect(findings).toHaveLength(1);
    expect(findings[0].category).toBe("bare_exception");
  });

  it("throws on empty string", () => {
    expect(() => parseLearnResponse("")).toThrow("Empty LLM response");
  });

  it("throws on non-JSON prose", () => {
    expect(() => parseLearnResponse("I cannot analyze this.")).toThrow(
      "No JSON array found in response",
    );
  });

  it("throws when parsed value is not a JSON array", () => {
    expect(() => parseLearnResponse('{"key":"value"}')).toThrow(
      "No JSON array found in response",
    );
  });

  it("generates id when source JSON omits it", () => {
    const noId = VALID_LEARN_JSON.replace('"id":"f-001",', "");
    const findings = parseLearnResponse(noId);
    expect(findings[0].id).toBeTruthy();
    expect(typeof findings[0].id).toBe("string");
  });

  it("preserves explanation text faithfully", () => {
    const findings = parseLearnResponse(VALID_LEARN_JSON);
    expect(findings[0].explanation).toContain("## What");
    expect(findings[0].explanation).toContain("## Exercise");
  });
});

// ── analyzeLearn() ────────────────────────────────────────────────────────────

const FAKE_LEARN_PAYLOAD =
  '[{"id":"f-001","category":"bare_exception","severity":"medium",' +
  '"title":"Bare except swallows all errors","description":"A bare except: catches everything.",' +
  '"line_start":2,"line_end":2,"fix_hint":"Use except Exception as e:",' +
  '"explanation":"## What\\nBare except.\\n\\n## Why it is wrong\\nCatches all.\\n\\n' +
  "## What could fail\\nCtrl-C won't work.\\n\\n## Exercise\\nRewrite it.\"}]";

function makeMockLearnModel() {
  return {
    name: "copilot-claude-sonnet-4",
    id: "copilot-claude-sonnet-4",
    sendRequest: vi.fn().mockResolvedValue({
      text: (async function* () {
        yield FAKE_LEARN_PAYLOAD;
      })(),
    }),
  } as unknown as import("vscode").LanguageModelChat;
}

describe("analyzeLearn()", () => {
  const TEST_CODE = "try:\n    risky()\nexcept:\n    pass";

  it("returns mode === 'learn'", async () => {
    const result = await analyzeLearn(TEST_CODE, "python", makeMockLearnModel());
    expect(result.mode).toBe("learn");
  });

  it("returns demo_mode === false", async () => {
    const result = await analyzeLearn(TEST_CODE, "python", makeMockLearnModel());
    expect(result.demo_mode).toBe(false);
  });

  it("findings_count equals findings.length", async () => {
    const result = await analyzeLearn(TEST_CODE, "python", makeMockLearnModel());
    expect(result.findings_count).toBe(result.findings.length);
  });

  it("result.code_hash matches computeCodeHash of the input code", async () => {
    const result = await analyzeLearn(TEST_CODE, "python", makeMockLearnModel());
    expect(result.code_hash).toBe(computeCodeHash(TEST_CODE));
  });

  it("parsed finding contains explanation text", async () => {
    const result = await analyzeLearn(TEST_CODE, "python", makeMockLearnModel());
    expect(result.findings[0].explanation).toBeTruthy();
    expect(result.findings[0].explanation).toContain("## What");
  });
});
