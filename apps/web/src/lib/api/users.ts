/**
 * apps/web/src/lib/api/users.ts
 * User endpoint wrappers.
 */

import type { UserResponse, PatchUserRequest } from "@debugiq/shared-types";
import { apiFetch } from "./client";

export function getMe(): Promise<UserResponse> {
  return apiFetch<UserResponse>("/v0/users/me");
}

export function patchMe(body: PatchUserRequest): Promise<UserResponse> {
  return apiFetch<UserResponse>("/v0/users/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
