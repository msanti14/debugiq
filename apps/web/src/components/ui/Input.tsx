"use client";

import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Input({
  label,
  hint,
  error,
  className = "",
  id,
  ...props
}: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-white/80"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`rounded-lg border border-white/10 bg-surface-0 px-3 py-2 text-sm text-white placeholder-muted transition-colors focus:border-brand-500/60 focus:outline-none ${
          error ? "border-red-500/60" : ""
        } ${className}`}
        {...props}
      />
      {hint && !error && (
        <p className="text-xs text-muted">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
