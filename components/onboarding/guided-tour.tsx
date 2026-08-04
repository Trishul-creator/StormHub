"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  MousePointerClick,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/types/database";

interface TourStep {
  selector: string;
  title: string;
  description: string;
  interaction?: "click";
  interactionLabel?: string;
  optional?: boolean;
  skipWhenMissing?: boolean;
}

interface TargetBox {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

const TOUR_VERSION = "pilot-v3";

function navigationStep(
  selector: string,
  title: string,
  description: string,
  interactionLabel: string
): TourStep {
  return {
    selector,
    title,
    description,
    interaction: "click",
    interactionLabel,
  };
}

function mobileMenuStep(title: string): TourStep {
  return {
    selector: '[data-tour="mobile-menu"]',
    title,
    description: "On smaller screens, the main destinations live inside this menu. Open it to continue.",
    interaction: "click",
    interactionLabel: "Open menu",
    optional: true,
    skipWhenMissing: true,
  };
}

function isAccountSetupPath(pathname: string): boolean {
  return pathname.startsWith("/auth/") || pathname === "/account-status";
}

function isRoleHomePath(pathname: string, role: UserRole): boolean {
  if (role === "super_admin" || role === "district_admin") return pathname === "/admin/districts";
  if (role === "admin" || role === "teacher") return pathname === "/manage";
  return pathname === "/dashboard";
}

function welcomeStep(roleLabel: string): TourStep {
  return {
    selector: '[data-tour="brand"]',
    title: "Welcome to StormHub",
    description: `This ${roleLabel} walkthrough uses the real navigation. The StormHub logo always returns to the public home page.`,
  };
}

function directorySteps(role: "student" | "teacher" | "admin", primaryTitle: string): TourStep[] {
  return [
    mobileMenuStep("Open the main menu"),
    navigationStep(
      '[data-tour="clubs-nav"]',
      "Open the club directory",
      "Click Clubs now. The tour will follow you to the directory.",
      "Open Clubs"
    ),
    {
      selector: '[data-tour="club-directory-tools"]',
      title: "Search and filter clubs",
      description: "Search by name or description, then narrow the catalog by category and other available filters.",
    },
    {
      selector: '[data-tour="club-directory-results"]',
      title: "Browse the complete catalog",
      description: "Results update from your filters. Club cards show the information you need before opening a club.",
    },
    {
      selector: '[data-tour="club-card-link"]',
      title: "Open a club",
      description: "Click a club to see its full public profile and the actions available to your role.",
      interaction: "click",
      interactionLabel: "View this club",
      optional: true,
    },
    {
      selector: '[data-tour="club-detail-overview"]',
      title: "Understand the club",
      description: "The detail page collects the club description, category, sponsor, meeting information, member count, and activity.",
      optional: true,
    },
    {
      selector: '[data-tour="club-detail-action"]',
      title: "Use the role-appropriate action",
      description: role === "student"
        ? "Request to join a club, or open the member workspace after approval."
        : "Review the public club profile without student join controls.",
      optional: true,
    },
    mobileMenuStep("Open the main menu again"),
    navigationStep(
      '[data-tour="calendar-nav"]',
      "Open the school calendar",
      "Click Calendar to see how meetings, events, and deadlines are organized.",
      "Open Calendar"
    ),
    {
      selector: '[data-tour="calendar-toolbar"]',
      title: "Move through the calendar",
      description: "Use these controls to change the date range and return to the current date.",
    },
    {
      selector: '[data-tour="calendar-grid"]',
      title: "Inspect scheduled activity",
      description: "Open an item for its time, location, club, details, and any RSVP controls available to your role.",
    },
    mobileMenuStep("Open the main menu again"),
    navigationStep(
      '[data-tour="opportunities-nav"]',
      "Open Opportunities",
      "Click Opportunities to browse applications, tryouts, auditions, service activities, and other school programs.",
      "Open Opportunities"
    ),
    {
      selector: '[data-tour="opportunity-tools"]',
      title: "Find the right opportunity",
      description: "Search and filter by category, timing, and status. Signed-up opportunities remain visibly highlighted for students.",
    },
    {
      selector: '[data-tour="opportunity-results"]',
      title: "Review available opportunities",
      description: "Each card summarizes eligibility, deadlines, dates, and participation status.",
    },
    {
      selector: '[data-tour="opportunity-card-link"]',
      title: "Open an opportunity",
      description: "Click a result to see its complete details and the controls available to your role.",
      interaction: "click",
      interactionLabel: "View details",
      optional: true,
    },
    {
      selector: '[data-tour="opportunity-detail"]',
      title: "Review before taking action",
      description: role === "student"
        ? "Read the eligibility and deadline, then save, sign up, or RSVP. A completed sign-up replaces the sign-up button with confirmation."
        : "Teachers and administrators can review school opportunities here in read-only mode.",
      optional: true,
    },
    mobileMenuStep("Open the main menu again"),
    navigationStep(
      '[data-tour="primary-nav"]',
      `Return to ${primaryTitle.toLowerCase()}`,
      "Use the first top-level menu item whenever you want to return to your role's starting workspace.",
      `Open ${primaryTitle}`
    ),
  ];
}

function studentTourSteps(canManage: boolean): TourStep[] {
  return [
    welcomeStep("student"),
    {
      selector: '[data-tour="role-overview"]',
      title: "Your dashboard",
      description: "Your dashboard gathers joined clubs, classwork, events, and saved opportunities without crowding the page.",
    },
    {
      selector: '[data-tour="dashboard-priorities"]',
      title: "Start with what needs attention",
      description: "This short queue combines your closest assignment, opportunity, and event deadlines. It never shows more than four items.",
      optional: true,
    },
    {
      selector: '[data-tour="dashboard-summary"]',
      title: "Use the quick summary",
      description: "These numbers link to the complete club, event, and opportunity views behind them.",
      optional: true,
    },
    {
      selector: '[data-tour="role-checklist"]',
      title: "Open setup only when needed",
      description: "The optional checklist stays collapsed after setup so the dashboard remains focused.",
      optional: true,
    },
    {
      selector: '[data-tour="student-clubs"]',
      title: "Your club workspaces",
      description: "Open a joined club for its stream, assignments, people, events, and resources.",
      optional: true,
    },
    ...(canManage ? [
      {
        selector: '[data-tour="leadership-overview"]',
        title: "Your leadership shortcut",
        description: "Presidents and Vice Presidents can jump into the clubs they help manage.",
        optional: true,
      },
    ] : []),
    ...directorySteps("student", "your dashboard"),
    ...(canManage ? [
      mobileMenuStep("Open leadership navigation"),
      navigationStep(
        '[data-tour="manage-nav"]',
        "Open your leadership workspace",
        "Presidents and Vice Presidents use Manage for the tools granted by their club role.",
        "Open Manage",
      ),
      {
        selector: '[data-tour="managed-clubs"]',
        title: "Choose the club you lead",
        description: "Open a club to draft content, track work, maintain the roster, or coordinate events according to your role.",
      },
    ] : []),
    ...accountSteps("student"),
  ];
}

function teacherTourSteps(): TourStep[] {
  return [
    welcomeStep("Advisor"),
    {
      selector: '[data-tour="role-overview"]',
      title: "Your management home",
      description: "Your assigned clubs, grading work, deadlines, and approvals begin here.",
    },
    {
      selector: '[data-tour="dashboard-priorities"]',
      title: "Review urgent club work",
      description: "See submissions to grade, approaching coursework, and club events before opening a full workspace.",
      optional: true,
    },
    {
      selector: '[data-tour="dashboard-summary"]',
      title: "Scan your workload",
      description: "Use these shortcuts to open the complete view behind each count.",
      optional: true,
    },
    {
      selector: '[data-tour="role-checklist"]',
      title: "Advisor setup guide",
      description: "Expand this only when you need help finishing your Advisor setup.",
      optional: true,
    },
    {
      selector: '[data-tour="managed-clubs"]',
      title: "Open a sponsored club",
      description: "Each club has one workspace for posts, coursework, grading, people, events, resources, and attendance. School admins—not Advisors—archive clubs.",
      optional: true,
    },
    {
      selector: '[data-tour="management-tools"]',
      title: "Advisor-wide tools",
      description: "Use this menu for cross-club approvals and digest work; club-specific tasks stay inside the club.",
      optional: true,
    },
    ...directorySteps("teacher", "your management home"),
    ...accountSteps("teacher"),
  ];
}

function adminTourSteps(): TourStep[] {
  return [
    welcomeStep("school administrator"),
    {
      selector: '[data-tour="role-overview"]',
      title: "School operations",
      description: "Begin with approvals, assigned clubs, school activity, and issues that need administrator attention.",
    },
    {
      selector: '[data-tour="dashboard-priorities"]',
      title: "Handle the priority queue",
      description: "Pending approvals and near-term school activity are limited to the most important items.",
      optional: true,
    },
    {
      selector: '[data-tour="dashboard-summary"]',
      title: "Open complete school views",
      description: "The summary stays compact; each number is a shortcut to the full workflow.",
      optional: true,
    },
    {
      selector: '[data-tour="managed-clubs"]',
      title: "Manage school clubs",
      description: "Open a club workspace for content, assignments, people, attendance, settings, or administrator-only archival.",
      optional: true,
    },
    {
      selector: '[data-tour="management-tools"]',
      title: "Use school management tools",
      description: "Approvals and school-wide opportunity management live here; individual club tools stay in their club.",
      optional: true,
    },
    ...directorySteps("admin", "school operations"),
    mobileMenuStep("Open administration navigation"),
    navigationStep(
      '[data-tour="administration-nav"]',
      "Open school administration",
      "Administration contains tenant-level settings and remains restricted to your school.",
      "Open Administration",
    ),
    {
      selector: '[data-tour="admin-tools"]',
      title: "School administration menu",
      description: "Statistics, users, moderation, deletion requests, and the audit log remain together here.",
    },
    {
      selector: '[data-tour="admin-users"]',
      title: "Users and roles",
      description: "Assign teacher or student roles, manage account status, and keep every action inside your school.",
    },
    {
      selector: '[data-tour="admin-moderation"]',
      title: "Moderation and approvals",
      description: "Review pending school content from one approval queue.",
    },
    ...accountSteps("admin"),
  ];
}

function districtAdminTourSteps(): TourStep[] {
  return [
    welcomeStep("district administrator"),
    {
      selector: '[data-tour="role-overview"]',
      title: "Your district workspace",
      description: "Every school and statistic remains limited to your assigned district.",
    },
    {
      selector: '[data-tour="district-schools"]',
      title: "Open a school workspace",
      description: "Choose a school for its settings, users, opportunities, previews, and school-level statistics.",
    },
    {
      selector: '[data-tour="admin-tools"]',
      title: "District administration menu",
      description: "Move between district structure, scoped statistics, users, moderation, deletion requests, and audit history.",
    },
    {
      selector: '[data-tour="admin-statistics"]',
      title: "District statistics",
      description: "Compare adoption and club activity across schools without leaving your district scope.",
    },
    {
      selector: '[data-tour="admin-users"]',
      title: "District user management",
      description: "Choose a school, then assign its teachers and school administrators with confirmation for important changes.",
    },
    ...accountSteps("district_admin"),
  ];
}

function superAdminTourSteps(): TourStep[] {
  return [
    welcomeStep("platform administrator"),
    {
      selector: '[data-tour="role-overview"]',
      title: "Platform administration",
      description: "Start from the district chooser, then enter a school only when school-scoped work is required.",
    },
    {
      selector: '[data-tour="district-workspaces"]',
      title: "Manage the tenant hierarchy",
      description: "Create or edit districts, open district workspaces, and manage the schools inside them.",
    },
    {
      selector: '[data-tour="admin-tools"]',
      title: "Platform administration menu",
      description: "All platform controls are grouped here rather than scattered across unrelated buttons.",
    },
    {
      selector: '[data-tour="admin-statistics"]',
      title: "Platform and district statistics",
      description: "Begin with platform totals, then narrow to one district or school when needed.",
    },
    {
      selector: '[data-tour="admin-users"]',
      title: "Platform users and roles",
      description: "Manage in-scope accounts and assign district administrators with step-up confirmation.",
    },
    {
      selector: '[data-tour="admin-moderation"]',
      title: "Platform moderation overview",
      description: "Inspect approval activity while school and district operators retain their scoped responsibilities.",
    },
    {
      selector: '[data-tour="admin-support"]',
      title: "Support inbox",
      description: "Choose a school to review and respond to its submitted ticket. Start private-data access only when resolving it truly requires protected records.",
    },
    {
      selector: '[data-tour="admin-offboarding"]',
      title: "Complete tenant offboarding",
      description: "Submit and advance the audited workflow after identity confirmation, then choose the deletion date and time once the export is approved.",
    },
    {
      selector: '[data-tour="admin-system-health"]',
      title: "Production health",
      description: "Check database migrations, email delivery, scheduled jobs, and other release-critical configuration.",
    },
    ...accountSteps("super_admin"),
  ];
}

export function buildTourSteps(role: UserRole, canManage: boolean): TourStep[] {
  switch (role) {
    case "super_admin":
      return superAdminTourSteps();
    case "district_admin":
      return districtAdminTourSteps();
    case "admin":
      return adminTourSteps();
    case "teacher":
      return teacherTourSteps();
    default:
      return studentTourSteps(canManage);
  }
}

function accountSteps(role: UserRole): TourStep[] {
  return [
    mobileMenuStep("Open account navigation"),
    {
      selector: '[data-tour="notifications-trigger"]',
      title: "Open your notifications",
      description: "Click the bell to see promotions, approvals, grades, club posts, and other important updates.",
      interaction: "click",
      interactionLabel: "Open notifications",
    },
    {
      selector: '[data-tour="notification-panel"]',
      title: "Stay current",
      description: "Unread updates are highlighted. Open an item to go to the related work, or mark everything as read.",
      optional: true,
    },
    mobileMenuStep("Open account navigation again"),
    {
      selector: '[data-tour="appearance"]',
      title: "Choose your appearance",
      description: "Switch between light and dark mode. System mode follows your device setting throughout StormHub.",
    },
    {
      selector: '[data-tour="settings"]',
      title: "Open account settings",
      description: "Click Settings for profile, notifications, connected Google Drive, appearance, data controls, and account deletion.",
      interaction: "click",
      interactionLabel: "Open Settings",
    },
    {
      selector: '[data-tour="settings-navigation"]',
      title: "Use the settings menu",
      description: "The side menu groups settings by purpose so you can jump directly to the section you need.",
    },
    {
      selector: '[data-tour="settings-content"]',
      title: "You are ready",
      description: `That is the complete ${role.replace("_", " ")} tour. You can replay it from this page whenever you need a refresher.`,
    },
  ];
}

function findVisibleTarget(selector: string): HTMLElement | null {
  const candidates = [...document.querySelectorAll<HTMLElement>(selector)];
  return candidates.find((element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0
      && rect.height > 0
      && style.display !== "none"
      && style.visibility !== "hidden";
  }) ?? null;
}

function clickableElement(target: HTMLElement): HTMLElement | null {
  if (target.matches("a, button, [role='button']")) return target;
  return target.querySelector<HTMLElement>("a, button, [role='button']");
}

export function GuidedTour({
  userId,
  role,
  canManage,
  autoStart,
  revision,
}: {
  userId: string;
  role: UserRole;
  canManage: boolean;
  autoStart: boolean;
  revision?: string | null;
}) {
  const pathname = usePathname();
  const steps = useMemo(() => buildTourSteps(role, canManage), [canManage, role]);
  const storageKey = `stormhub:tour:${TOUR_VERSION}:${userId}:${role}:${revision ?? "initial"}`;
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetBox, setTargetBox] = useState<TargetBox | null>(null);
  const [targetUnavailable, setTargetUnavailable] = useState(false);
  const [position, setPosition] = useState<"above" | "below">("below");
  const primaryButtonRef = useRef<HTMLButtonElement>(null);

  const persistProgress = useCallback((index: number) => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ status: "active", stepIndex: index }));
    } catch {
      // The walkthrough still works for this page when browser storage is unavailable.
    }
  }, [storageKey]);

  const finish = useCallback(() => {
    try {
      window.localStorage.setItem(storageKey, "complete");
    } catch {
      // The walkthrough should still close when browser storage is unavailable.
    }
    setActive(false);
    setTargetBox(null);
    setTargetUnavailable(false);
  }, [storageKey]);

  const goTo = useCallback((requestedIndex: number) => {
    if (requestedIndex >= steps.length) {
      finish();
      return;
    }
    const nextIndex = Math.max(0, requestedIndex);
    persistProgress(nextIndex);
    setTargetBox(null);
    setTargetUnavailable(false);
    setStepIndex(nextIndex);
  }, [finish, persistProgress, steps.length]);

  useEffect(() => {
    setMounted(true);
    const forceStart = new URLSearchParams(window.location.search).get("tour") === "1";
    if (forceStart) {
      const url = new URL(window.location.href);
      url.searchParams.delete("tour");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }

    // A profile can exist briefly while Google onboarding, policy acceptance, or
    // account-status handling is still in progress. Never place the product tour
    // over those account-completion screens.
    if (isAccountSetupPath(pathname)) return;

    let savedValue: string | null = null;
    try {
      savedValue = window.localStorage.getItem(storageKey);
    } catch {
      savedValue = null;
    }

    if (!forceStart && savedValue === "complete") return;

    let resumeIndex = 0;
    let hasActiveProgress = false;
    if (!forceStart && savedValue) {
      try {
        const saved = JSON.parse(savedValue) as { status?: string; stepIndex?: number };
        if (saved.status === "active" && Number.isInteger(saved.stepIndex)) {
          hasActiveProgress = true;
          resumeIndex = Math.min(Math.max(saved.stepIndex ?? 0, 0), steps.length - 1);
        }
      } catch {
        resumeIndex = 0;
      }
    }
    if (!forceStart && !hasActiveProgress && (!autoStart || !isRoleHomePath(pathname, role))) return;

    const timeout = window.setTimeout(() => {
      persistProgress(resumeIndex);
      setStepIndex(resumeIndex);
      setActive(true);
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [autoStart, pathname, persistProgress, role, steps.length, storageKey]);

  useEffect(() => {
    if (!active) return;
    const step = steps[stepIndex];
    let target: HTMLElement | null = null;
    let attempts = 0;

    const updatePosition = () => {
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const padding = 8;
      const top = Math.max(8, rect.top - padding);
      const left = Math.max(8, rect.left - padding);
      const right = Math.min(window.innerWidth - 8, rect.right + padding);
      const bottom = Math.min(window.innerHeight - 8, rect.bottom + padding);
      setTargetBox({
        top,
        left,
        right,
        bottom,
        width: Math.max(1, right - left),
        height: Math.max(1, bottom - top),
      });
      setPosition(rect.bottom + 300 < window.innerHeight ? "below" : "above");
    };

    const locate = () => {
      target = findVisibleTarget(step.selector);
      if (target) {
        window.clearInterval(interval);
        setTargetUnavailable(false);
        target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        updatePosition();
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);
        return;
      }

      attempts += 1;
      const maxAttempts = step.optional ? 12 : 40;
      if (attempts >= maxAttempts) {
        window.clearInterval(interval);
        if (step.skipWhenMissing) {
          goTo(stepIndex + 1);
        } else {
          // Missing data (for example no clubs or priorities yet) should not race
          // through the walkthrough. Keep the step visible and let the user move
          // on when they have read the explanation.
          setTargetUnavailable(true);
        }
      }
    };

    const interval = window.setInterval(locate, 100);
    locate();
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [active, goTo, stepIndex, steps]);

  useEffect(() => {
    if (!active || (!targetBox && !targetUnavailable)) return;
    const step = steps[stepIndex];
    if (targetUnavailable) {
      primaryButtonRef.current?.focus();
      return;
    }
    const target = findVisibleTarget(step.selector);
    if (!target || step.interaction !== "click") return;

    const handleTargetClick = () => goTo(stepIndex + 1);
    target.addEventListener("click", handleTargetClick, { once: true });
    return () => target.removeEventListener("click", handleTargetClick);
  }, [active, goTo, stepIndex, steps, targetBox, targetUnavailable]);

  useEffect(() => {
    if (!active || !targetBox) return;
    const step = steps[stepIndex];
    if (step.interaction === "click") {
      clickableElement(findVisibleTarget(step.selector) ?? document.body)?.focus();
    } else {
      primaryButtonRef.current?.focus();
    }
  }, [active, stepIndex, steps, targetBox, targetUnavailable]);

  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
      if (
        event.key === "ArrowRight"
        && (steps[stepIndex].interaction !== "click" || targetUnavailable)
      ) {
        goTo(stepIndex + 1);
      }
      if (
        event.key === "ArrowLeft"
        && stepIndex > 0
      ) {
        goTo(stepIndex - 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, finish, goTo, stepIndex, steps, targetUnavailable]);

  if (!mounted || !active || (!targetBox && !targetUnavailable)) return null;

  const step = steps[stepIndex];
  const hasPrevious = stepIndex > 0;
  const clickTargetAvailable = step.interaction === "click" && Boolean(targetBox);
  const tooltipStyle =
    targetUnavailable
      ? window.innerWidth < 640
        ? { left: 16, right: 16, top: "50%", transform: "translateY(-50%)" }
        : { left: "50%", top: "50%", width: 380, transform: "translate(-50%, -50%)" }
    : window.innerWidth < 640
      ? { left: 16, right: 16, bottom: 16 }
      : {
          left: Math.min(Math.max(16, targetBox!.left), window.innerWidth - 396),
          top: position === "below"
            ? Math.min(targetBox!.bottom + 16, window.innerHeight - 300)
            : Math.max(16, targetBox!.top - 284),
          width: 380,
        };

  return createPortal(
    <div aria-live="polite">
      {targetBox ? (
        <>
          <div className="fixed inset-x-0 top-0 z-[70] bg-slate-950/75" style={{ height: targetBox.top }} aria-hidden="true" />
          <div className="fixed inset-x-0 z-[70] bg-slate-950/75" style={{ top: targetBox.bottom, bottom: 0 }} aria-hidden="true" />
          <div className="fixed left-0 z-[70] bg-slate-950/75" style={{ top: targetBox.top, width: targetBox.left, height: targetBox.height }} aria-hidden="true" />
          <div className="fixed right-0 z-[70] bg-slate-950/75" style={{ top: targetBox.top, left: targetBox.right, height: targetBox.height }} aria-hidden="true" />
          <div
            className="pointer-events-none fixed z-[80] rounded-xl ring-2 ring-white ring-offset-2 ring-offset-storm-electric transition-all duration-300"
            style={{
              top: targetBox.top,
              left: targetBox.left,
              width: targetBox.width,
              height: targetBox.height,
              boxShadow: "0 12px 36px rgb(2 6 23 / 0.34)",
            }}
            aria-hidden="true"
          />
        </>
      ) : (
        <div className="fixed inset-0 z-[70] bg-slate-950/75" aria-hidden="true" />
      )}
      <section
        role="dialog"
        aria-modal="false"
        aria-labelledby="guided-tour-title"
        aria-describedby="guided-tour-description"
        className="fixed z-[90] overflow-hidden rounded-2xl border border-white/15 bg-card text-card-foreground shadow-2xl"
        style={tooltipStyle}
      >
        <div className="bg-storm-gradient px-5 py-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/80">
              <Compass className="h-4 w-4" /> Interactive StormHub tour
            </p>
            <button
              type="button"
              onClick={finish}
              className="rounded-md p-1 text-white/75 transition-colors hover:bg-white/15 hover:text-white"
              aria-label="Close walkthrough"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-300"
              style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-storm-electric">
            Step {stepIndex + 1} of {steps.length}
          </p>
          <h2 id="guided-tour-title" className="mt-1 text-xl font-semibold text-storm-navy">
            {step.title}
          </h2>
          <p id="guided-tour-description" className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {step.description}
          </p>
          {clickTargetAvailable && (
            <p className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-900 dark:bg-blue-950/50 dark:text-blue-200">
              <MousePointerClick className="h-4 w-4 shrink-0" />
              Click the highlighted control to continue.
            </p>
          )}
          {targetUnavailable && (
            <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              This section is not available on the current screen yet. It may appear after your
              school adds content or after you receive the related permission. Continue when you
              are ready—the tour will not skip ahead on its own.
            </p>
          )}
          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={finish}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-storm-navy"
            >
              Skip tour
            </button>
            <div className="flex gap-2">
              {hasPrevious && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => goTo(stepIndex - 1)}
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
              )}
              {clickTargetAvailable ? (
                <>
                  <Button type="button" variant="ghost" size="sm" onClick={() => goTo(stepIndex + 1)}>
                    Skip step
                  </Button>
                  <Button
                    ref={primaryButtonRef}
                    type="button"
                    size="sm"
                    onClick={() => clickableElement(findVisibleTarget(step.selector) ?? document.body)?.click()}
                  >
                    {step.interactionLabel ?? "Open"} <ArrowRight className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button
                  ref={primaryButtonRef}
                  type="button"
                  size="sm"
                  onClick={() => stepIndex + 1 >= steps.length ? finish() : goTo(stepIndex + 1)}
                >
                  {stepIndex + 1 < steps.length
                    ? <>Next <ArrowRight className="h-4 w-4" /></>
                    : <>Finish <Check className="h-4 w-4" /></>}
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}
