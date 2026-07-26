"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  FileCheck2,
  History,
  Inbox,
  LayoutDashboard,
  ShieldCheck,
  UserRoundX,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";

interface AdminNavigationProps {
  isSuperAdmin: boolean;
}

const sharedLinks = [
  { href: "/admin/statistics", label: "Statistics", icon: BarChart3 },
  { href: "/admin/users", label: "Users & roles", icon: Users },
  { href: "/admin/content", label: "Moderation", icon: FileCheck2 },
  { href: "/admin/deletion-requests", label: "Deletion requests", icon: UserRoundX },
  { href: "/admin/audit", label: "Audit log", icon: History },
];

export function AdminNavigation({ isSuperAdmin }: AdminNavigationProps) {
  const pathname = usePathname();
  const links = [
    isSuperAdmin
      ? { href: "/admin/schools", label: "Schools", icon: Building2 }
      : { href: "/admin", label: "Overview", icon: LayoutDashboard },
    ...sharedLinks.slice(0, 3),
    ...(isSuperAdmin ? [{ href: "/admin/feedback", label: "Support inbox", icon: Inbox }] : []),
    ...sharedLinks.slice(3),
  ];

  const isActive = (href: string) => (
    href === "/admin"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`)
  );

  return (
    <div className="sticky top-16 z-40 border-b border-slate-200/80 bg-white/95 shadow-[0_1px_0_rgba(15,23,42,0.03)] backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="container mx-auto flex min-w-0 items-center gap-3 px-4">
        <div className="hidden shrink-0 items-center gap-2 border-r border-slate-200 pr-4 xl:flex">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-storm-navy text-white shadow-sm">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-storm-electric">
              {isSuperAdmin ? "Platform" : "School"}
            </span>
            <span className="block text-xs text-muted-foreground">Administration</span>
          </span>
        </div>

        <nav
          aria-label="Administration"
          className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {links.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);

            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex min-w-fit items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-[background-color,color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-storm-electric focus-visible:ring-offset-2 motion-reduce:transform-none",
                  active
                    ? "bg-storm-navy text-white shadow-sm"
                    : "text-storm-navy/70 hover:-translate-y-0.5 hover:bg-storm-light/60 hover:text-storm-electric"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    active ? "text-storm-electric" : "text-storm-blue/70 group-hover:text-storm-electric"
                  )}
                  aria-hidden="true"
                />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
