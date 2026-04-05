/**
 * Settings page tests.
 * Covers: renders user info, successful display_name update, error on failure.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockRefreshUser = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/auth/context", () => ({
  useAuth: () => ({
    user: {
      user_id: "user-1",
      email: "settings@example.com",
      display_name: "Old Name",
      tier: "free" as const,
      created_at: "2025-06-01T00:00:00Z",
    },
    loading: false,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    clearError: vi.fn(),
    refreshUser: mockRefreshUser,
  }),
}));

// ── Imports ────────────────────────────────────────────────────────────────────

import * as usersApi from "@/lib/api/users";
import { ApiError } from "@/lib/api/client";
import type { UserResponse } from "@debugiq/shared-types";
import SettingsPage from "@/app/(app)/settings/page";

// ── Tests ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks();
  mockRefreshUser.mockResolvedValue(undefined);
});

describe("SettingsPage — renders user info", () => {
  it("shows the user's email", () => {
    render(<SettingsPage />);
    expect(screen.getByText("settings@example.com")).toBeTruthy();
  });

  it("shows the user's tier", () => {
    render(<SettingsPage />);
    expect(screen.getByText("free")).toBeTruthy();
  });

  it("pre-populates the display name input", () => {
    render(<SettingsPage />);
    const input = screen.getByRole("textbox", { name: /display name/i });
    expect((input as HTMLInputElement).value).toBe("Old Name");
  });
});

describe("SettingsPage — successful save", () => {
  it("shows the success banner after patchMe resolves", async () => {
    const patchedUser: UserResponse = {
      user_id: "user-1",
      email: "settings@example.com",
      display_name: "New Name",
      tier: "free",
      created_at: "2025-06-01T00:00:00Z",
    };
    vi.spyOn(usersApi, "patchMe").mockResolvedValue(patchedUser);

    render(<SettingsPage />);

    const input = screen.getByRole("textbox", { name: /display name/i });
    fireEvent.change(input, { target: { value: "New Name" } });

    fireEvent.submit(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(screen.getByText("Profile updated successfully.")).toBeTruthy(),
    );

    expect(usersApi.patchMe).toHaveBeenCalledWith({
      display_name: "New Name",
    });
    expect(mockRefreshUser).toHaveBeenCalled();
  });
});

describe("SettingsPage — error on save", () => {
  it("shows an error banner when patchMe rejects", async () => {
    vi.spyOn(usersApi, "patchMe").mockRejectedValue(
      new ApiError(422, "validation_error"),
    );

    render(<SettingsPage />);

    fireEvent.submit(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeTruthy(),
    );
    expect(screen.getByText("validation_error")).toBeTruthy();
  });
});
