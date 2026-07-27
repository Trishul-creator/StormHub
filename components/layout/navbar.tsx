"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Menu, Search, X, Zap, LogOut, Settings, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/utils";
import { demoSignOut, supabaseSignOut } from "@/lib/actions";
import { usePathname, useRouter } from "next/navigation";
import type { UserRole } from "@/types/database";
import type { Notification } from "@/types/database";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "@/components/theme/theme-controls";

const baseNavLinks = [
  { href: "/", label: "Home" },
  { href: "/clubs", label: "Clubs" },
  { href: "/calendar", label: "Calendar" },
  { href: "/opportunities", label: "Opportunities" },
];

interface NavbarProps {
  isLoggedIn?: boolean;
  userEmail?: string;
  isDemoMode?: boolean;
  canManage?: boolean;
  role?: UserRole;
  notifications?: Notification[];
  unreadNotificationCount?: number;
  schoolSlug?: string | null;
}

export function Navbar({
  isLoggedIn,
  userEmail,
  isDemoMode,
  canManage,
  role,
  notifications = [],
  unreadNotificationCount = 0,
  schoolSlug,
}: NavbarProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const primaryHref = role === "super_admin" ? "/admin/schools" : role === "admin" || role === "teacher" ? "/manage" : "/dashboard";
  const primaryLabel = role === "super_admin" ? "Platform Admin" : role === "admin" || role === "teacher" ? "Manage" : "Dashboard";
  const schoolClubHref = schoolSlug ? `/s/${schoolSlug}/clubs` : "/clubs";
  const schoolCalendarHref = schoolSlug ? `/s/${schoolSlug}/calendar` : "/calendar";
  const schoolOpportunitiesHref = schoolSlug ? `/s/${schoolSlug}/opportunities` : "/opportunities";
  const navLinks = !isLoggedIn
    ? baseNavLinks
    : role === "super_admin"
      ? [{ href: primaryHref, label: primaryLabel }]
      : role === "admin" || role === "teacher"
        ? [
            { href: primaryHref, label: primaryLabel },
            { href: schoolClubHref, label: "Clubs" },
            { href: schoolCalendarHref, label: "Calendar" },
            { href: schoolOpportunitiesHref, label: "Opportunities" },
            ...(role === "admin"
              ? [
                  { href: "/admin", label: "Administration" },
                ]
              : []),
          ]
        : [
            { href: primaryHref, label: primaryLabel },
            { href: schoolClubHref, label: "Clubs" },
            { href: schoolCalendarHref, label: "Calendar" },
            { href: schoolOpportunitiesHref, label: "Opportunities" },
          ];
  const isActivePath = (href: string) => {
    if (role === "super_admin" && href === primaryHref && pathname.startsWith("/admin")) return true;
    return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  };

  async function handleSignOut() {
    if (isDemoMode) await demoSignOut();
    else await supabaseSignOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-card/95 shadow-sm transition-shadow duration-300 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="group flex items-center gap-2 font-bold text-storm-navy">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-storm-gradient shadow-sm transition-[transform,box-shadow] duration-300 group-hover:rotate-3 group-hover:scale-105 group-hover:shadow-md motion-reduce:transform-none">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="transition-colors group-hover:text-storm-electric">{APP_NAME}</span>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActivePath(link.href) ? "page" : undefined}
              className={cn(
                "relative py-2 text-sm font-medium transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-left after:rounded-full after:bg-storm-electric after:transition-transform after:duration-200 hover:text-storm-electric hover:after:scale-x-100",
                isActivePath(link.href)
                  ? "text-storm-electric after:scale-x-100"
                  : "text-storm-navy/70 after:scale-x-0"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {isLoggedIn ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/search" aria-label="Search"><Search className="h-4 w-4" /></Link>
              </Button>
              {canManage && role !== "super_admin" && primaryHref !== "/manage" && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/manage"><Shield className="h-4 w-4 mr-1" />Manage</Link>
                </Button>
              )}
              <NotificationBell notifications={notifications} unreadCount={unreadNotificationCount} />
              <ThemeToggle />
              <Button variant="ghost" size="sm" asChild>
                <Link
                  href="/settings"
                  aria-label="Settings"
                  aria-current={isActivePath("/settings") ? "page" : undefined}
                  className={isActivePath("/settings") ? "bg-storm-light/70 text-storm-electric" : undefined}
                >
                  <Settings className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-1" />Sign out
              </Button>
            </>
          ) : (
            <>
              <ThemeToggle />
              <Button variant="ghost" size="sm" asChild>
                <Link href="/auth/sign-in">Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/auth/sign-up">Get started</Link>
              </Button>
            </>
          )}
        </div>

        <button className="rounded-lg p-2 transition-colors hover:bg-storm-light/60 lg:hidden" onClick={() => setOpen(!open)} aria-label="Toggle menu" aria-expanded={open}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="animate-in border-t bg-card px-4 py-4 duration-200 fade-in slide-in-from-top-2 lg:hidden">
          <nav className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActivePath(link.href) ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActivePath(link.href) ? "bg-storm-light/60 text-storm-electric" : "hover:bg-storm-light/40"
                )}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <hr className="my-2" />
            {isLoggedIn ? (
              <>
                <ThemeToggle showLabel />
                <Link href="/search" className="text-sm font-medium py-2" onClick={() => setOpen(false)}>Search</Link>
                {canManage && role !== "super_admin" && primaryHref !== "/manage" && <Link href="/manage" className="text-sm font-medium py-2" onClick={() => setOpen(false)}>Manage</Link>}
                <Link href="/notifications" className="text-sm font-medium py-2" onClick={() => setOpen(false)}>
                  Notifications{unreadNotificationCount > 0 ? ` (${unreadNotificationCount})` : ""}
                </Link>
                <Link
                  href="/settings"
                  aria-current={isActivePath("/settings") ? "page" : undefined}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActivePath("/settings") ? "bg-storm-light/60 text-storm-electric" : "hover:bg-storm-light/40"
                  )}
                  onClick={() => setOpen(false)}
                >
                  Settings
                </Link>
                <button onClick={handleSignOut} className="text-sm font-medium py-2 text-left text-red-600">Sign out</button>
              </>
            ) : (
              <>
                <ThemeToggle showLabel />
                <Link href="/auth/sign-in" className="text-sm font-medium py-2" onClick={() => setOpen(false)}>Sign in</Link>
                <Link href="/auth/sign-up" className="text-sm font-medium py-2 text-storm-electric" onClick={() => setOpen(false)}>Get started</Link>
              </>
            )}
          </nav>
        </div>
      )}

      {isDemoMode && (
        <div className="bg-amber-50 border-t border-amber-200 px-4 py-1.5 text-center text-xs text-amber-800">
          Demo mode — configure Supabase in .env.local for full functionality
        </div>
      )}
    </header>
  );
}
