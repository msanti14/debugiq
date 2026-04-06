/**
 * apps/web/src/app/layout.tsx
 *
 * Root layout — required by Next.js App Router.
 * Mounts AuthProvider so auth context is available to every route,
 * including /login and /register (which are outside the (app) group).
 *
 * This is a Server Component so Next.js can export `metadata`.
 * AuthProvider is a Client Component imported here; the client boundary
 * lives at AuthProvider, not here.
 */

import "./globals.css";
import React from "react";
import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth/context";

export const metadata: Metadata = {
  title: "DebugIQ",
  description: "AI-powered code analysis",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
