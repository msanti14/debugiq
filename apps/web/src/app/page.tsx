/**
 * apps/web/src/app/page.tsx
 *
 * Root entry point. Redirects immediately to /dashboard.
 * If the user is unauthenticated, the (app)/layout.tsx guard will
 * intercept the /dashboard request and redirect to /login.
 */

import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/dashboard");
}
