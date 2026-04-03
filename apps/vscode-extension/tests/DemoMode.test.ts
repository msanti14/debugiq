import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DemoMode } from "../src/demo/DemoMode";

// ── Setup ─────────────────────────────────────────────────────────────────────

let demo: DemoMode;

beforeEach(() => {
  demo = new DemoMode();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── isEnabled ─────────────────────────────────────────────────────────────────

describe("DemoMode.isEnabled()", () => {
  it("returns true", () => {
    expect(demo.isEnabled()).toBe(true);
  });
});

// ── getFixtures ───────────────────────────────────────────────────────────────

describe("DemoMode.getFixtures()", () => {
  it("returns exactly 3 fixtures", () => {
    expect(demo.getFixtures()).toHaveLength(3);
  });

  it("all fixtures have demo_mode: true", () => {
    for (const r of demo.getFixtures()) {
      expect(r.demo_mode).toBe(true);
    }
  });

  it("all fixtures have model_used: 'demo'", () => {
    for (const r of demo.getFixtures()) {
      expect(r.model_used).toBe("demo");
    }
  });

  it("findings_count equals findings.length for every fixture", () => {
    for (const r of demo.getFixtures()) {
      expect(r.findings_count).toBe(r.findings.length);
    }
  });

  it("all result_ids are unique", () => {
    const ids = demo.getFixtures().map((r) => r.result_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all titles are 80 chars or fewer", () => {
    for (const r of demo.getFixtures()) {
      for (const f of r.findings) {
        expect(f.title.length).toBeLessThanOrEqual(80);
      }
    }
  });

  it("all descriptions are 500 chars or fewer", () => {
    for (const r of demo.getFixtures()) {
      for (const f of r.findings) {
        expect(f.description.length).toBeLessThanOrEqual(500);
      }
    }
  });

  it("all code_hashes match a 64-char hex string", () => {
    for (const r of demo.getFixtures()) {
      expect(r.code_hash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("makes no HTTP calls (global.fetch is not invoked)", () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    demo.getFixtures();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ── getFixture ────────────────────────────────────────────────────────────────

describe("DemoMode.getFixture()", () => {
  it("python + quick → sql_injection, critical, exactly 1 finding", () => {
    const result = demo.getFixture("python", "quick");
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].category).toBe("sql_injection");
    expect(result.findings[0].severity).toBe("critical");
  });

  it("typescript + quick → null_unhandled, high, exactly 1 finding", () => {
    const result = demo.getFixture("typescript", "quick");
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].category).toBe("null_unhandled");
    expect(result.findings[0].severity).toBe("high");
  });

  it("python + learn → bare_exception, medium, exactly 1 finding", () => {
    const result = demo.getFixture("python", "learn");
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].category).toBe("bare_exception");
    expect(result.findings[0].severity).toBe("medium");
  });

  it("quick fixtures have fix_hint defined and non-empty", () => {
    const pythonQuick = demo.getFixture("python", "quick");
    const tsQuick = demo.getFixture("typescript", "quick");
    expect(pythonQuick.findings[0].fix_hint).toBeTruthy();
    expect(tsQuick.findings[0].fix_hint).toBeTruthy();
  });

  it("learn fixture explanation contains 'What' section", () => {
    const result = demo.getFixture("python", "learn");
    expect(result.findings[0].explanation).toMatch(/what/i);
  });

  it("learn fixture explanation contains 'Why' section", () => {
    const result = demo.getFixture("python", "learn");
    expect(result.findings[0].explanation).toMatch(/why/i);
  });

  it("learn fixture explanation contains 'What could fail' section", () => {
    const result = demo.getFixture("python", "learn");
    expect(result.findings[0].explanation).toMatch(/what could fail/i);
  });

  it("learn fixture explanation contains 'Exercise' section", () => {
    const result = demo.getFixture("python", "learn");
    expect(result.findings[0].explanation).toMatch(/exercise/i);
  });

  it("falls back gracefully for an undefined combination (typescript + learn)", () => {
    // typescript+learn fixture doesn't exist; must return something valid (not throw)
    const result = demo.getFixture("typescript", "learn");
    expect(result).toBeDefined();
    expect(result.findings.length).toBeGreaterThanOrEqual(1);
  });

  it("makes no HTTP calls (global.fetch is not invoked)", () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    demo.getFixture("python", "quick");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
