"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { Button } from "@/components/ui/Button";

interface NavItem {
  href: string;
  label: string;
  /** Phase-2 items are visually marked as coming soon. */
  phase2?: boolean;
  /** SVG path string for icon */
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M4 10v10a1 1 0 001 1h5v-5h4v5h5a1 1 0 001-1V10" />
      </svg>
    ),
  },
  {
    href: "/team",
    label: "Team",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2h5M12 12a4 4 0 100-8 4 4 0 000 8z" />
      </svg>
    ),
  },
  {
    href: "/dojo",
    label: "Dojo",
    phase2: true,
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      </svg>
    ),
  },
  {
    href: "/billing",
    label: "Billing",
    phase2: true,
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="flex w-60 flex-col gap-6 border-r border-white/5 bg-surface-1 px-4 py-6">
      {/* Brand */}
      <div className="flex items-center gap-2 px-2">
        <span className="text-lg font-bold tracking-tight text-white">
          Debug<span className="text-brand-500">IQ</span>
        </span>
        <span className="rounded bg-brand-900/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-500">
          beta
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-brand-500/15 text-white"
                  : "text-muted hover:bg-surface-2 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-2.5">
                {item.icon}
                {item.label}
              </span>
              {item.phase2 && (
                <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted">
                  soon
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="flex flex-col gap-3 border-t border-white/5 pt-4">
        {user && (
          <div className="px-2">
            <p className="truncate text-sm font-medium text-white">
              {user.display_name ?? user.email.split("@")[0]}
            </p>
            <p className="truncate text-xs text-muted">{user.email}</p>
            <span className="mt-1 inline-block rounded bg-brand-900/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-500">
              {user.tier}
            </span>
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={logout} className="w-full justify-start px-2">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </Button>
      </div>
    </aside>
  );
}
