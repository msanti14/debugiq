"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/context";
import { patchMe } from "@/lib/api/users";
import { ApiError } from "@/lib/api/client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type SaveState = "idle" | "saving" | "success" | "error";

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveState("saving");
    setErrorMsg(null);
    try {
      const trimmed = displayName.trim();
      await patchMe({ display_name: trimmed || undefined });
      await refreshUser();
      setSaveState("success");
      // Auto-clear the success banner after 3 seconds.
      setTimeout(() => setSaveState((s) => (s === "success" ? "idle" : s)), 3000);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.detail : "Failed to save changes.";
      setErrorMsg(msg);
      setSaveState("error");
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Settings</h1>
        <p className="mt-0.5 text-sm text-muted">
          Manage your profile and account.
        </p>
      </div>

      {/* Profile card */}
      <div className="max-w-lg rounded-lg border border-white/5 bg-surface-1 p-6">
        <h2 className="mb-5 text-xs font-semibold uppercase tracking-wider text-muted">
          Profile
        </h2>

        <form onSubmit={handleSave} className="flex flex-col gap-4" noValidate>
          {/* Email — read only */}
          <div>
            <p className="mb-1 text-sm font-medium text-white/80">Email</p>
            <p
              aria-label="Email address"
              className="rounded-lg border border-white/5 bg-surface-0 px-3 py-2 text-sm text-muted"
            >
              {user?.email ?? "—"}
            </p>
          </div>

          {/* Plan — read only */}
          <div>
            <p className="mb-1 text-sm font-medium text-white/80">Plan</p>
            <p
              aria-label="Current plan"
              className="rounded-lg border border-white/5 bg-surface-0 px-3 py-2 text-sm capitalize text-muted"
            >
              {user?.tier ?? "—"}
            </p>
          </div>

          {/* Member since — read only */}
          {user?.created_at && (
            <div>
              <p className="mb-1 text-sm font-medium text-white/80">
                Member since
              </p>
              <p
                aria-label="Member since"
                className="rounded-lg border border-white/5 bg-surface-0 px-3 py-2 text-sm text-muted"
              >
                {new Date(user.created_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          )}

          {/* Display name — editable */}
          <Input
            label="Display name"
            type="text"
            autoComplete="name"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              if (saveState !== "idle") setSaveState("idle");
            }}
            hint="Shown in the sidebar and dashboard."
            placeholder="Your name"
          />

          {/* Feedback banners */}
          {saveState === "success" && (
            <div
              role="status"
              className="rounded-lg border border-green-700/50 bg-green-900/20 px-4 py-3 text-sm text-green-300"
            >
              Profile updated successfully.
            </div>
          )}
          {saveState === "error" && errorMsg && (
            <div
              role="alert"
              className="rounded-lg border border-red-700/50 bg-red-900/20 px-4 py-3 text-sm text-red-300"
            >
              {errorMsg}
            </div>
          )}

          <Button
            type="submit"
            loading={saveState === "saving"}
            className="w-full sm:w-auto"
          >
            Save changes
          </Button>
        </form>
      </div>
    </div>
  );
}
