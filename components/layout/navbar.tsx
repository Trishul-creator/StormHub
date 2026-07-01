"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Bot, Menu, X, Zap, LogOut, LayoutDashboard, Settings, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/utils";
import { demoSignOut, supabaseSignOut } from "@/lib/actions";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/types/database";
import type { Notification } from "@/types/database";
import { NotificationBell } from "@/components/notifications/notification-bell";

const baseNavLinks = [
  { href: "/", label: "Home" },
  { href: "/clubs", label: "Clubs" },
  { href: "/calendar", label: "Calendar" },
];

const platformNavLinks = [
  { href: "/", label: "Home" },
  { href: "/admin/schools", label: "Schools" },
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
  const navLinks =
    role === "super_admin"
      ? platformNavLinks
      : role === "teacher"
      ? schoolSlug
        ? [
            { href: "/", label: "Home" },
            { href: `/s/${schoolSlug}/clubs`, label: "Clubs" },
            { href: `/s/${schoolSlug}/calendar`, label: "Calendar" },
          ]
        : baseNavLinks
      : schoolSlug
        ? [
            { href: "/", label: "Home" },
            { href: `/s/${schoolSlug}/clubs`, label: "Clubs" },
            { href: `/s/${schoolSlug}/calendar`, label: "Calendar" },
            { href: `/s/${schoolSlug}/opportunities`, label: "Opportunities" },
          ]
        : [...baseNavLinks, { href: "/opportunities", label: "Opportunities" }];
  const primaryHref = role === "super_admin" ? "/admin/schools" : role === "admin" || role === "teacher" ? "/manage" : "/dashboard";
  const primaryLabel = role === "super_admin" ? "Platform Admin" : role === "admin" || role === "teacher" ? "Manage" : "Dashboard";

  async function handleSignOut() {
    if (isDemoMode) await demoSignOut();
    else await supabaseSignOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-storm-navy">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-storm-gradient">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span>{APP_NAME}</span>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-storm-navy/70 hover:text-storm-electric transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {isLoggedIn ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href={primaryHref}><LayoutDashboard className="h-4 w-4 mr-1" />{primaryLabel}</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/assistant"><Bot className="h-4 w-4 mr-1" />Assistant</Link>
              </Button>
              {canManage && role !== "super_admin" && primaryHref !== "/manage" && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/manage"><Shield className="h-4 w-4 mr-1" />Manage</Link>
                </Button>
              )}
              <NotificationBell notifications={notifications} unreadCount={unreadNotificationCount} />
              <Button variant="ghost" size="sm" asChild>
                <Link href="/settings"><Settings className="h-4 w-4" /></Link>
              </Button>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-1" />Sign out
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/auth/sign-in">Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/auth/sign-up">Get started</Link>
              </Button>
            </>
          )}
        </div>

        <button className="lg:hidden p-2" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t bg-white px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm font-medium py-2" onClick={() => setOpen(false)}>
                {link.label}
              </Link>
            ))}
            <hr className="my-2" />
            {isLoggedIn ? (
              <>
                <Link href={primaryHref} className="text-sm font-medium py-2" onClick={() => setOpen(false)}>{primaryLabel}</Link>
                <Link href="/assistant" className="text-sm font-medium py-2" onClick={() => setOpen(false)}>Assistant</Link>
                {canManage && role !== "super_admin" && primaryHref !== "/manage" && <Link href="/manage" className="text-sm font-medium py-2" onClick={() => setOpen(false)}>Manage</Link>}
                <Link href="/notifications" className="text-sm font-medium py-2" onClick={() => setOpen(false)}>
                  Notifications{unreadNotificationCount > 0 ? ` (${unreadNotificationCount})` : ""}
                </Link>
                <Link href="/settings" className="text-sm font-medium py-2" onClick={() => setOpen(false)}>Settings</Link>
                <button onClick={handleSignOut} className="text-sm font-medium py-2 text-left text-red-600">Sign out</button>
              </>
            ) : (
              <>
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
