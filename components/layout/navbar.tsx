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
import { useDismissibleLayer } from "@/hooks/use-dismissible-layer";
import { useLanguage } from "@/components/i18n/language-provider";
import { LanguageSwitcher } from "@/components/i18n/language-controls";

interface NavbarProps {
  isLoggedIn?: boolean;
  userEmail?: string;
  isDemoMode?: boolean;
  canManage?: boolean;
  role?: UserRole;
  notifications?: Notification[];
  unreadNotificationCount?: number;
  schoolSlug?: string | null;
  districtSlug?: string | null;
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
  districtSlug,
}: NavbarProps) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const mobileMenuRef = useDismissibleLayer<HTMLElement>(open, () => setOpen(false));
  const primaryHref = role === "super_admin"
    ? "/admin/districts"
    : role === "district_admin"
      ? districtSlug
        ? `/admin/districts/${districtSlug}`
        : "/admin/districts"
      : role === "admin" || role === "teacher"
        ? "/manage"
        : "/dashboard";
  const primaryLabel = role === "super_admin"
    ? t("common.platformAdmin")
    : role === "district_admin"
      ? t("common.districtAdmin")
      : role === "admin" || role === "teacher"
        ? t("common.manage")
        : t("common.dashboard");
  const baseNavLinks = [
    { href: "/", label: t("common.home"), tourKey: "home" },
    { href: "/clubs", label: t("common.clubs"), tourKey: "clubs" },
    { href: "/calendar", label: t("common.calendar"), tourKey: "calendar" },
    { href: "/opportunities", label: t("common.opportunities"), tourKey: "opportunities" },
  ];
  const schoolClubHref = schoolSlug ? `/s/${schoolSlug}/clubs` : "/clubs";
  const schoolCalendarHref = schoolSlug ? `/s/${schoolSlug}/calendar` : "/calendar";
  const schoolOpportunitiesHref = schoolSlug ? `/s/${schoolSlug}/opportunities` : "/opportunities";
  const navLinks = !isLoggedIn
    ? baseNavLinks
      : role === "super_admin" || role === "district_admin"
      ? [{ href: primaryHref, label: primaryLabel, tourKey: "primary" }]
      : role === "admin" || role === "teacher"
        ? [
            { href: primaryHref, label: primaryLabel, tourKey: "primary" },
            { href: schoolClubHref, label: t("common.clubs"), tourKey: "clubs" },
            { href: schoolCalendarHref, label: t("common.calendar"), tourKey: "calendar" },
            { href: schoolOpportunitiesHref, label: t("common.opportunities"), tourKey: "opportunities" },
            ...(role === "admin"
              ? [
                  { href: "/admin", label: t("common.administration"), tourKey: "administration" },
                ]
              : []),
          ]
        : [
            { href: primaryHref, label: primaryLabel, tourKey: "primary" },
            { href: schoolClubHref, label: t("common.clubs"), tourKey: "clubs" },
            { href: schoolCalendarHref, label: t("common.calendar"), tourKey: "calendar" },
            { href: schoolOpportunitiesHref, label: t("common.opportunities"), tourKey: "opportunities" },
          ];
  const isActivePath = (href: string) => {
    if ((role === "super_admin" || role === "district_admin") && href === primaryHref && pathname.startsWith("/admin")) return true;
    return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  };
  const tourTargetForLink = (tourKey: string) => {
    if (tourKey === "primary") return "primary-nav";
    if (tourKey === "clubs") return "clubs-nav";
    if (tourKey === "calendar") return "calendar-nav";
    if (tourKey === "opportunities") return "opportunities-nav";
    if (tourKey === "administration") return "administration-nav";
    return undefined;
  };

  async function handleSignOut() {
    if (isDemoMode) await demoSignOut();
    else await supabaseSignOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header ref={mobileMenuRef} className="sticky top-0 z-50 border-b bg-card/95 shadow-sm transition-shadow duration-300 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" data-tour="brand" className="group flex items-center gap-2 font-bold text-storm-navy">
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
              data-tour={tourTargetForLink(link.tourKey)}
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
                <Link href="/search" aria-label={t("common.search")}><Search className="h-4 w-4" /></Link>
              </Button>
              {canManage && role !== "super_admin" && role !== "district_admin" && primaryHref !== "/manage" && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/manage" data-tour="manage-nav"><Shield className="h-4 w-4 mr-1" />{t("common.manage")}</Link>
                </Button>
              )}
              <span data-tour="notifications" className="inline-flex">
                <NotificationBell notifications={notifications} unreadCount={unreadNotificationCount} />
              </span>
              <span data-tour="appearance" className="inline-flex">
                <ThemeToggle />
              </span>
              <LanguageSwitcher />
              <Button variant="ghost" size="sm" asChild>
                <Link
                  href="/settings"
                  data-tour="settings"
                  aria-label={t("common.settings")}
                  aria-current={isActivePath("/settings") ? "page" : undefined}
                  className={isActivePath("/settings") ? "bg-storm-light/70 text-storm-electric" : undefined}
                >
                  <Settings className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-1" />{t("common.signOut")}
              </Button>
            </>
          ) : (
            <>
              <ThemeToggle />
              <LanguageSwitcher />
              <Button variant="ghost" size="sm" asChild>
                <Link href="/auth/sign-in">{t("common.signIn")}</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/auth/sign-up">{t("common.getStarted")}</Link>
              </Button>
            </>
          )}
        </div>

        <button
          data-tour="mobile-menu"
          className="rounded-lg p-2 transition-colors hover:bg-storm-light/60 lg:hidden"
          onClick={() => setOpen(!open)}
          aria-label={t("common.toggleMenu")}
          aria-expanded={open}
          aria-controls="mobile-navigation"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div id="mobile-navigation" className="animate-in border-t bg-card px-4 py-4 duration-200 fade-in slide-in-from-top-2 lg:hidden">
          <nav className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                data-tour={tourTargetForLink(link.tourKey)}
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
                <span data-tour="appearance"><ThemeToggle showLabel /></span>
                <LanguageSwitcher showLabel />
                <Link href="/search" className="text-sm font-medium py-2" onClick={() => setOpen(false)}>{t("common.search")}</Link>
                {canManage && role !== "super_admin" && role !== "district_admin" && primaryHref !== "/manage" && <Link href="/manage" data-tour="manage-nav" className="text-sm font-medium py-2" onClick={() => setOpen(false)}>{t("common.manage")}</Link>}
                <Link href="/notifications" data-tour="notifications-trigger" className="text-sm font-medium py-2" onClick={() => setOpen(false)}>
                  {t("common.notifications")}{unreadNotificationCount > 0 ? ` (${unreadNotificationCount})` : ""}
                </Link>
                <Link
                  href="/settings"
                  data-tour="settings"
                  aria-current={isActivePath("/settings") ? "page" : undefined}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActivePath("/settings") ? "bg-storm-light/60 text-storm-electric" : "hover:bg-storm-light/40"
                  )}
                  onClick={() => setOpen(false)}
                >
                  {t("common.settings")}
                </Link>
                <button onClick={handleSignOut} className="text-sm font-medium py-2 text-left text-red-600">{t("common.signOut")}</button>
              </>
            ) : (
              <>
                <ThemeToggle showLabel />
                <LanguageSwitcher showLabel />
                <Link href="/auth/sign-in" className="text-sm font-medium py-2" onClick={() => setOpen(false)}>{t("common.signIn")}</Link>
                <Link href="/auth/sign-up" className="text-sm font-medium py-2 text-storm-electric" onClick={() => setOpen(false)}>{t("common.getStarted")}</Link>
              </>
            )}
          </nav>
        </div>
      )}

      {isDemoMode && (
        <div className="bg-amber-50 border-t border-amber-200 px-4 py-1.5 text-center text-xs text-amber-800">
          {t("nav.demoMode")}
        </div>
      )}
    </header>
  );
}
