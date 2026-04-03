import { describe, it, expect, beforeEach } from "vitest";
import { SignatureStore } from "../src/signatures/SignatureStore";
import type { WorkspaceStateStorage } from "../src/signatures/SignatureStore";

// ── In-memory storage mock ────────────────────────────────────────────────────

function makeStorage(): WorkspaceStateStorage {
  const store = new Map<string, unknown>();
  return {
    get<T>(key: string): T | undefined {
      return store.get(key) as T | undefined;
    },
    async update(key: string, value: unknown): Promise<void> {
      store.set(key, value);
    },
  };
}

// ── SignatureStore ─────────────────────────────────────────────────────────────

describe("SignatureStore — getLastSignature()", () => {
  it("returns undefined when no signature has been stored yet", () => {
    const store = new SignatureStore(makeStorage());
    expect(store.getLastSignature("repo-a")).toBeUndefined();
  });

  it("returns the stored signature after setLastSignature", async () => {
    const store = new SignatureStore(makeStorage());
    await store.setLastSignature("repo-a", "abc123");
    expect(store.getLastSignature("repo-a")).toBe("abc123");
  });

  it("updates to the latest value on repeated calls", async () => {
    const store = new SignatureStore(makeStorage());
    await store.setLastSignature("repo-a", "first");
    await store.setLastSignature("repo-a", "second");
    expect(store.getLastSignature("repo-a")).toBe("second");
  });
});

describe("SignatureStore — classifySignature()", () => {
  it("returns 'new' when no signature has been stored yet", () => {
    const store = new SignatureStore(makeStorage());
    expect(store.classifySignature("repo-a", "abc123")).toBe("new");
  });

  it("returns 'repeated' when the stored signature matches", async () => {
    const store = new SignatureStore(makeStorage());
    await store.setLastSignature("repo-a", "abc123");
    expect(store.classifySignature("repo-a", "abc123")).toBe("repeated");
  });

  it("returns 'new' when the stored signature differs", async () => {
    const store = new SignatureStore(makeStorage());
    await store.setLastSignature("repo-a", "abc123");
    expect(store.classifySignature("repo-a", "xyz789")).toBe("new");
  });

  it("does not persist the new signature when classifying", async () => {
    const store = new SignatureStore(makeStorage());
    await store.setLastSignature("repo-a", "old-sig");
    store.classifySignature("repo-a", "new-sig"); // classify only, don't store
    expect(store.getLastSignature("repo-a")).toBe("old-sig");
  });
});

describe("SignatureStore — repoKey isolation", () => {
  it("different repoKeys maintain independent state", async () => {
    const store = new SignatureStore(makeStorage());
    await store.setLastSignature("repo-a", "sig-for-a");
    // repo-b has never been stored — should be undefined and classify as "new"
    expect(store.getLastSignature("repo-b")).toBeUndefined();
    expect(store.classifySignature("repo-b", "sig-for-a")).toBe("new");
  });

  it("storing for repo-b does not affect repo-a", async () => {
    const store = new SignatureStore(makeStorage());
    await store.setLastSignature("repo-a", "sig-a");
    await store.setLastSignature("repo-b", "sig-b");
    expect(store.getLastSignature("repo-a")).toBe("sig-a");
    expect(store.getLastSignature("repo-b")).toBe("sig-b");
  });

  it("classifySignature is 'repeated' only for the correct repoKey", async () => {
    const store = new SignatureStore(makeStorage());
    await store.setLastSignature("repo-a", "shared-sig");
    // repo-b hasn't seen this sig yet → "new"
    expect(store.classifySignature("repo-b", "shared-sig")).toBe("new");
    // repo-a has seen it → "repeated"
    expect(store.classifySignature("repo-a", "shared-sig")).toBe("repeated");
  });
});

describe("SignatureStore — setLastSignature()", () => {
  it("setLastSignature resolves without error", async () => {
    const store = new SignatureStore(makeStorage());
    await expect(store.setLastSignature("repo-a", "abc")).resolves.toBeUndefined();
  });

  it("persists a full 64-char SHA-256 hex signature faithfully", async () => {
    const sig = "a".repeat(64);
    const store = new SignatureStore(makeStorage());
    await store.setLastSignature("repo-a", sig);
    expect(store.getLastSignature("repo-a")).toBe(sig);
  });
});
