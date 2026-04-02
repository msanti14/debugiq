# ADR-001: LLM Calls Happen in the Extension, Not the Backend

**Date:** April 2026
**Status:** Accepted
**Deciders:** Solo founder

---

## Context

DebugIQ's core analysis features require calls to LLM APIs (Claude, GPT-4o).
The question is: where should those calls originate — the VS Code extension or the FastAPI backend?

## Decision

**LLM calls happen exclusively in the VS Code extension. The backend never proxies, forwards, or initiates LLM requests.**

## Consequences

### Positive

- **Privacy by architecture:** User API keys never leave the local machine. They are stored in `vscode.SecretStorage` (OS keychain) and consumed directly by the extension. The backend has no key-shaped fields in any endpoint schema — a future contributor cannot accidentally add key forwarding without changing the API contract.
- **Zero backend LLM cost:** The backend is pure persistence + auth. No LLM billing, rate limit management, or model timeouts on the server side.
- **Offline-capable demo mode:** Because analysis is local, `DemoMode.ts` can return fixture results with zero network calls — mandatory for first-run UX.
- **Simpler compliance posture:** Code analyzed by the LLM is processed on the user's machine. The backend only receives structured results (findings) and a SHA-256 hash of the snippet — never raw code.

### Negative / Trade-offs

- **No server-side caching of LLM responses.** Duplicate analyses of identical snippets (same `code_hash`) are not deduplicated at the API level in Phase 0. Accepted for MVP — can be mitigated client-side in Phase 1.
- **Business Logic Layer (Phase 2+) will need careful design.** BLL context must be embedded into the prompt client-side, which means the extension must retrieve BLL data from the backend before each analysis call. This adds a round-trip but preserves the key-isolation invariant.

## Sync Rule (shared types)

Any change to a type in `packages/shared-types/src/domain.ts` **must** include a
matching update to the corresponding Pydantic model in `apps/api/src/results/router.py`
**in the same commit**.

No automated enforcement exists in Phase 0. The PR review checklist must include:

> **"Did you update both `shared-types/domain.ts` and the Pydantic model in `results/router.py`?"**

Automated enforcement (e.g., a script that diffs the two files) is planned for Phase 2
when schema drift becomes a real risk.

## Alternatives Considered

**Backend as LLM proxy:** Rejected. Requires users to send their API keys to the server or requires DebugIQ to hold master API keys — unacceptable privacy and cost model for a solo-founder MVP.

**Backend holds all API keys, billed centrally:** Rejected for Phase 0. Requires billing infrastructure, key rotation, and cost attribution before any product validation. Revisit in Phase 2 if a "bring no key" tier is validated.
