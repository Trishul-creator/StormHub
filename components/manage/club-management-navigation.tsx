"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Eye,
  LayoutDashboard,
  PlusCircle,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";

interface ClubManagementNavigationProps {
  clubName: string;
  slug: string;
  canManageRoster: boolean;
}

export function ClubManagementNavigation({
  clubName,
  slug,
  canManageRoster,
}: ClubManagementNavigationProps) {
  const pathname = usePathname();
  const baseHref = `/manage/clubs/${slug}`;
  const links = [
    { href: baseHref, label: "Overview", icon: LayoutDashboard },
    { href: `${baseHref}/announcements`, label: "Create", icon: PlusCircle, contentHub: true },
    ...(canManageRoster
      ? [{ href: `${baseHref}/members`, label: "Members", icon: Users }]
      : []),
    { href: `${baseHref}/edit`, label: "Settings", icon: Settings },
  ];
  const isActive = (href: string, contentHub?: boolean) => (
    contentHub
      ? [
          `${baseHref}/announcements`,
          `${baseHref}/coursework`,
          `${baseHref}/events`,
          `${baseHref}/resources`,
        ].some((path) => pathname === path || pathname.startsWith(`${path}/`))
      : href === baseHref
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`)
  );

  return (
    <div className="container mx-auto px-4 pt-6">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b bg-storm-light/25 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-storm-electric">
              Club workspace
            </p>
            <p className="truncate font-semibold text-storm-navy">{clubName}</p>
          </div>
          <Link
            href={`/clubs/${slug}/member`}
            className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-card hover:text-storm-electric"
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Member view</span>
          </Link>
        </div>
        <nav
          aria-label={`${clubName} management`}
          className="flex gap-1 overflow-x-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {links.map(({ href, label, icon: Icon, contentHub }) => {
            const active = isActive(href, contentHub);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-w-fit items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-storm-electric/10 text-storm-electric"
                    : "text-muted-foreground hover:bg-storm-light/60 hover:text-storm-navy"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
