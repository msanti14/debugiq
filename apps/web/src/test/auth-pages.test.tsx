/**
 * apps/web/src/test/auth-pages.test.tsx
 *
 * Tests for LoginPage and RegisterPage.
 * Covers per page:
 *   - successful submit → router.replace('/dashboard') called
 *   - loading/disabled state while the async call is in-flight
 *   - error banner rendered when the call rejects
 *   - already-authenticated user is redirected to /dashboard
 *   - renders null (no flash) during initial auth loading
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockLogin = vi.fn();
const mockRegister = vi.fn();
const mockReplace = vi.fn();

// `mockUseAuth` is a vi.fn() so individual tests can call
// mockUseAuth.mockReturnValue({...}) to override auth state while the existing
// 6 tests continue to rely on the safe default set in beforeEach.
const mockUseAuth = vi.fn();

vi.mock("@/lib/auth/context", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ replace: mockReplace })),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => React.createElement("a", { href, className }, children),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────────

import LoginPage from "@/app/login/page";
import RegisterPage from "@/app/register/page";

// ── Shared fixtures ────────────────────────────────────────────────────────────

/** The default auth state: unauthenticated, fully hydrated. */
const defaultAuth = () => ({
  login: mockLogin,
  register: mockRegister,
  user: null,
  loading: false,
  error: null,
  logout: vi.fn(),
  clearError: vi.fn(),
  refreshUser: vi.fn(),
});

/** A populated user object matching the UserResponse shape. */
const authedUser = {
  user_id: "user-1",
  email: "a@b.com",
  display_name: null,
  tier: "free" as const,
  created_at: "2025-01-01T00:00:00Z",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Fill the login form's email and password fields. */
function fillLoginForm(
  email = "user@example.com",
  password = "password123",
) {
  fireEvent.change(screen.getByLabelText(/^email$/i), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: password },
  });
}

/** Fill the register form's email and password fields (display name omitted). */
function fillRegisterForm(
  email = "user@example.com",
  password = "password123",
) {
  fireEvent.change(screen.getByLabelText(/^email$/i), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: password },
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Restore default auth state for every test so the existing 6 tests are
  // unaffected by any per-test override set in the new tests.
  mockUseAuth.mockReturnValue(defaultAuth());
  mockLogin.mockReset();
  mockRegister.mockReset();
  mockReplace.mockReset();
});

// ── LoginPage ─────────────────────────────────────────────────────────────────

describe("LoginPage — successful submit", () => {
  it("calls login() with credentials and navigates to /dashboard", async () => {
    mockLogin.mockResolvedValue(undefined);

    render(<LoginPage />);
    fillLoginForm();
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/dashboard"),
    );
    expect(mockLogin).toHaveBeenCalledWith("user@example.com", "password123");
  });
});

describe("LoginPage — loading/disabled state", () => {
  it("disables the submit button while the login call is in-flight", async () => {
    let resolveLogin!: () => void;
    mockLogin.mockReturnValue(
      new Promise<void>((res) => {
        resolveLogin = res;
      }),
    );

    render(<LoginPage />);
    fillLoginForm();
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /sign in/i }),
      ).toBeDisabled(),
    );

    // Resolve to let the component settle and avoid act() warnings.
    resolveLogin();
  });
});

describe("LoginPage — error rendering", () => {
  it("shows an error alert when login rejects", async () => {
    mockLogin.mockRejectedValue(new Error("invalid_credentials"));

    render(<LoginPage />);
    fillLoginForm();
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeTruthy(),
    );
    expect(screen.getByText("invalid_credentials")).toBeTruthy();
  });
});

// ── RegisterPage ──────────────────────────────────────────────────────────────

describe("RegisterPage — successful submit", () => {
  it("calls register() with credentials and navigates to /dashboard", async () => {
    mockRegister.mockResolvedValue(undefined);

    render(<RegisterPage />);
    fillRegisterForm();
    fireEvent.submit(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/dashboard"),
    );
    // display name left blank → undefined passed
    expect(mockRegister).toHaveBeenCalledWith(
      "user@example.com",
      "password123",
      undefined,
    );
  });
});

describe("RegisterPage — loading/disabled state", () => {
  it("disables the submit button while the register call is in-flight", async () => {
    let resolveRegister!: () => void;
    mockRegister.mockReturnValue(
      new Promise<void>((res) => {
        resolveRegister = res;
      }),
    );

    render(<RegisterPage />);
    fillRegisterForm();
    fireEvent.submit(
      screen.getByRole("button", { name: /create account/i }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /create account/i }),
      ).toBeDisabled(),
    );

    resolveRegister();
  });
});

describe("RegisterPage — error rendering", () => {
  it("shows an error alert when register rejects", async () => {
    mockRegister.mockRejectedValue(new Error("email_already_exists"));

    render(<RegisterPage />);
    fillRegisterForm();
    fireEvent.submit(
      screen.getByRole("button", { name: /create account/i }),
    );

    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeTruthy(),
    );
    expect(screen.getByText("email_already_exists")).toBeTruthy();
  });
});

// ── Already-authenticated redirect ────────────────────────────────────────────

describe("LoginPage — already-authenticated redirect", () => {
  it("redirects to /dashboard when user is already authenticated", async () => {
    mockUseAuth.mockReturnValue({
      ...defaultAuth(),
      user: authedUser,
      loading: false,
    });

    render(<LoginPage />);

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/dashboard"),
    );
  });

  it("renders null (no flash) during initial auth loading", () => {
    mockUseAuth.mockReturnValue({
      ...defaultAuth(),
      user: null,
      loading: true,
    });

    render(<LoginPage />);

    expect(screen.queryByRole("button", { name: /sign in/i })).toBeNull();
  });
});

describe("RegisterPage — already-authenticated redirect", () => {
  it("redirects to /dashboard when user is already authenticated", async () => {
    mockUseAuth.mockReturnValue({
      ...defaultAuth(),
      user: authedUser,
      loading: false,
    });

    render(<RegisterPage />);

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/dashboard"),
    );
  });

  it("renders null (no flash) during initial auth loading", () => {
    mockUseAuth.mockReturnValue({
      ...defaultAuth(),
      user: null,
      loading: true,
    });

    render(<RegisterPage />);

    expect(
      screen.queryByRole("button", { name: /create account/i }),
    ).toBeNull();
  });
});
