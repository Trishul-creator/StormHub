"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
}

interface TargetBox {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

const TOUR_VERSION = "pilot-v2";

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
  };
}

function buildTourSteps(role: UserRole, canManage: boolean): TourStep[] {
  const primaryTitle =
    role === "super_admin"
      ? "Platform administration"
      : role === "district_admin"
        ? "District administration"
      : role === "student"
        ? "Your dashboard"
        : "Your management home";
  const primaryDescription =
    role === "super_admin"
      ? "This is your platform district chooser. Open a district, then select a school before working with school-scoped data."
      : role === "district_admin"
        ? "This workspace shows only your district. Open a school for its users, settings, and school-level statistics."
      : role === "admin"
        ? "Management is your school operations home for approvals, assigned clubs, and administrative work."
        : role === "teacher"
          ? "Management is your command center for assigned clubs, coursework, rosters, and approvals."
          : "Your dashboard gathers your joined clubs, classwork, events, and saved opportunities.";

  const openingSteps: TourStep[] = [
    {
      selector: '[data-tour="brand"]',
      title: "Welcome to StormHub",
      description: "This walkthrough takes you through the real navigation. The StormHub logo always returns to the public home page.",
    },
    {
      selector: '[data-tour="role-overview"]',
      title: primaryTitle,
      description: primaryDescription,
    },
    {
      selector: '[data-tour="dashboard-priorities"]',
      title: "Start with what needs attention",
      description:
        role === "student"
          ? "This short queue combines your closest assignment, opportunity, and event deadlines. It never shows more than four items."
          : role === "super_admin" || role === "district_admin"
            ? "District and school cards keep organizational setup one click away."
            : role === "teacher"
              ? "This short queue combines submissions to grade, approaching coursework, and club events."
              : "This short queue combines pending approvals and upcoming school activity.",
      optional: true,
    },
    {
      selector: '[data-tour="dashboard-summary"]',
      title: "Use the quick summary",
      description: "These three numbers are shortcuts. Click one whenever you want the complete view behind it.",
      optional: true,
    },
    {
      selector: '[data-tour="role-checklist"]',
      title: "Open setup only when needed",
      description: "The optional checklist is collapsed to keep your dashboard focused. Expand it whenever you want setup guidance.",
      optional: true,
    },
    ...(role === "student"
      ? [
          {
            selector: '[data-tour="student-clubs"]',
            title: "Your club workspaces",
            description: "Joined clubs appear here. Open one to reach its stream, assignments, people, events, and resources.",
            optional: true,
          },
          ...(canManage
            ? [
                {
                  selector: '[data-tour="leadership-overview"]',
                  title: "Your leadership shortcut",
                  description: "Presidents and Vice Presidents can jump from the student dashboard into the clubs they help manage.",
                  optional: true,
                },
              ]
            : []),
        ]
      : role === "super_admin"
        ? [
            {
              selector: '[data-tour="district-workspaces"]',
              title: "Choose a district workspace",
              description: "Platform administrators open a district before selecting one of its school workspaces.",
            },
          ]
        : role === "district_admin"
          ? [
              {
                selector: '[data-tour="district-schools"]',
                title: "Choose a school in your district",
                description: "Every school here is inside your assigned district. Open one for scoped settings, users, previews, and statistics.",
              },
            ]
        : [
            {
              selector: '[data-tour="managed-clubs"]',
              title: "Open a managed club",
              description: "Each assigned club has one workspace for posts, coursework, people, events, resources, attendance, and settings.",
              optional: true,
            },
            {
              selector: '[data-tour="management-tools"]',
              title: "Management tools",
              description: "This secondary menu contains focused workflows such as approvals and the school digest. Club-specific tools stay inside each club workspace.",
              optional: true,
            },
          ]),
  ];

  if (role === "super_admin" || role === "district_admin") {
    return [
      ...openingSteps,
      {
        selector: '[data-tour="admin-tools"]',
        title: role === "super_admin" ? "Platform administration menu" : "District administration menu",
        description: role === "super_admin"
          ? "Use this menu for districts, statistics, users and roles, moderation, support, deletion requests, and the audit log."
          : "Use this menu for your district, scoped statistics, school-level users and roles, deletion requests, and the audit log.",
      },
      ...accountSteps(role),
    ];
  }

  const directorySteps: TourStep[] = [
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
      description: "Students can request to join or open joined clubs. Teachers and administrators see only the actions allowed by their role.",
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

  const leadershipSteps: TourStep[] =
    canManage && role === "student"
      ? [
          mobileMenuStep("Open leadership navigation"),
          {
            selector: '[data-tour="manage-nav"]',
            title: "Open your leadership workspace",
            description: "Presidents and Vice Presidents use Manage for the club tools permitted to their role.",
            interaction: "click",
            interactionLabel: "Open Manage",
          },
          {
            selector: '[data-tour="managed-clubs"]',
            title: "Choose the club you lead",
            description: "Open a managed club to create or draft content, review work, maintain the roster, or manage events according to your club role.",
          },
        ]
      : [];

  const administrationSteps: TourStep[] =
    role === "admin"
      ? [
          mobileMenuStep("Open administration navigation"),
          navigationStep(
            '[data-tour="administration-nav"]',
            "Open school administration",
            "Administration is separate from day-to-day club management and remains restricted to your assigned school.",
            "Open Administration"
          ),
          {
            selector: '[data-tour="admin-tools"]',
            title: "Use the administration menu",
            description: "This menu keeps statistics, users and roles, moderation, deletion requests, and audit history together.",
          },
        ]
      : [];

  return [
    ...openingSteps,
    ...directorySteps,
    ...leadershipSteps,
    ...administrationSteps,
    ...accountSteps(role),
  ];
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
  const steps = useMemo(() => buildTourSteps(role, canManage), [canManage, role]);
  const storageKey = `stormhub:tour:${TOUR_VERSION}:${userId}:${role}:${revision ?? "initial"}`;
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetBox, setTargetBox] = useState<TargetBox | null>(null);
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
  }, [storageKey]);

  const goTo = useCallback((requestedIndex: number) => {
    if (requestedIndex >= steps.length) {
      finish();
      return;
    }
    const nextIndex = Math.max(0, requestedIndex);
    persistProgress(nextIndex);
    setTargetBox(null);
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
    if (!forceStart && !autoStart && !hasActiveProgress) return;

    const timeout = window.setTimeout(() => {
      persistProgress(resumeIndex);
      setStepIndex(resumeIndex);
      setActive(true);
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [autoStart, persistProgress, steps.length, storageKey]);

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
        target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        updatePosition();
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);
        return;
      }

      attempts += 1;
      const maxAttempts = step.optional ? 4 : 30;
      if (attempts >= maxAttempts) {
        window.clearInterval(interval);
        goTo(stepIndex + 1);
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
    if (!active || !targetBox) return;
    const step = steps[stepIndex];
    const target = findVisibleTarget(step.selector);
    if (!target || step.interaction !== "click") return;

    const handleTargetClick = () => goTo(stepIndex + 1);
    target.addEventListener("click", handleTargetClick, { once: true });
    return () => target.removeEventListener("click", handleTargetClick);
  }, [active, goTo, stepIndex, steps, targetBox]);

  useEffect(() => {
    if (!active || !targetBox) return;
    const step = steps[stepIndex];
    if (step.interaction === "click") {
      clickableElement(findVisibleTarget(step.selector) ?? document.body)?.focus();
    } else {
      primaryButtonRef.current?.focus();
    }
  }, [active, stepIndex, steps, targetBox]);

  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
      if (event.key === "ArrowRight" && steps[stepIndex].interaction !== "click") {
        goTo(stepIndex + 1);
      }
      if (
        event.key === "ArrowLeft"
        && stepIndex > 0
        && findVisibleTarget(steps[stepIndex - 1].selector)
      ) {
        goTo(stepIndex - 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, finish, goTo, stepIndex, steps]);

  if (!mounted || !active || !targetBox) return null;

  const step = steps[stepIndex];
  const hasPrevious = stepIndex > 0 && Boolean(findVisibleTarget(steps[stepIndex - 1].selector));
  const tooltipStyle =
    window.innerWidth < 640
      ? { left: 16, right: 16, bottom: 16 }
      : {
          left: Math.min(Math.max(16, targetBox.left), window.innerWidth - 396),
          top: position === "below"
            ? Math.min(targetBox.bottom + 16, window.innerHeight - 300)
            : Math.max(16, targetBox.top - 284),
          width: 380,
        };

  return createPortal(
    <div aria-live="polite">
      <div
        className="fixed inset-x-0 top-0 z-[70] bg-slate-950/75"
        style={{ height: targetBox.top }}
        aria-hidden="true"
      />
      <div
        className="fixed inset-x-0 z-[70] bg-slate-950/75"
        style={{ top: targetBox.bottom, bottom: 0 }}
        aria-hidden="true"
      />
      <div
        className="fixed left-0 z-[70] bg-slate-950/75"
        style={{ top: targetBox.top, width: targetBox.left, height: targetBox.height }}
        aria-hidden="true"
      />
      <div
        className="fixed right-0 z-[70] bg-slate-950/75"
        style={{ top: targetBox.top, left: targetBox.right, height: targetBox.height }}
        aria-hidden="true"
      />
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
          {step.interaction === "click" && (
            <p className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-900 dark:bg-blue-950/50 dark:text-blue-200">
              <MousePointerClick className="h-4 w-4 shrink-0" />
              Click the highlighted control to continue.
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
              {step.interaction === "click" ? (
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
