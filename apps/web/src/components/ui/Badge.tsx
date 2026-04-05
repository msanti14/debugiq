"use client";

import React from "react";
import type { Severity, BugCategory } from "@debugiq/shared-types";

interface BadgeProps {
  variant?: "default" | "blue" | "purple" | "green" | "red" | "yellow";
  children: React.ReactNode;
  className?: string;
}

export function Badge({
  variant = "default",
  children,
  className = "",
}: BadgeProps) {
  const variants: Record<string, string> = {
    default: "bg-surface-2 text-muted",
    blue: "bg-blue-900/30 text-blue-300",
    purple: "bg-purple-900/30 text-purple-300",
    green: "bg-green-900/30 text-green-300",
    red: "bg-red-900/30 text-red-300",
    yellow: "bg-yellow-900/30 text-yellow-300",
  };

  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

const severityVariant: Record<Severity, BadgeProps["variant"]> = {
  critical: "red",
  high: "red",
  medium: "yellow",
  low: "blue",
  info: "default",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <Badge variant={severityVariant[severity]}>{severity}</Badge>;
}

export const categoryLabel: Record<BugCategory, string> = {
  sql_injection: "SQL Injection",
  null_unhandled: "Null Unhandled",
  hardcoded_secret: "Hardcoded Secret",
  bare_exception: "Bare Exception",
  client_side_auth: "Client-side Auth",
  cors_misconfigured: "CORS Misconfigured",
  xss: "XSS",
  other: "Other",
};
