"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Check, Compass, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/types/database";

interface TourStep {
  selector: string;
  title: string;
  description: string;
}

interface TargetBox {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
}

const TOUR_VERSION = "pilot-v1";

function buildTourSteps(role: UserRole, canManage: boolean): TourStep[] {
  const primaryDescription =
    role === "super_admin"
      ? "This opens the platform school chooser. Select a school before working with school-scoped data."
      : role === "admin"
        ? "Management is your school operations home for approvals, club activity, and administrative work."
        : role === "teacher"
          ? "Management is your command center for assigned clubs, coursework, rosters, and approvals."
          : "Your Dashboard gathers your joined clubs, classwork, events, and saved opportunities.";

  return [
    {
      selector: '[data-tour="brand"]',
      title: "Welcome to StormHub",
      description: "The StormHub logo always returns to the public home page, no matter which role you use.",
    },
    {
      selector: '[data-tour="mobile-menu"]',
      title: "Everything is in the menu",
      description: "On a phone or tablet, open this menu to reach your dashboard, clubs, calendar, opportunities, notifications, appearance, and settings.",
    },
    {
      selector: '[data-tour="primary-nav"]',
      title: role === "super_admin" ? "Platform administration" : role === "student" ? "Your dashboard" : "Your management home",
      description: primaryDescription,
    },
    {
      selector: '[data-tour="clubs-nav"]',
      title: "Find clubs",
      description: "Browse the complete school club directory, use search and filters, and open a club to see how to join.",
    },
    {
      selector: '[data-tour="calendar-nav"]',
      title: "Use the calendar",
      description: "See meetings, practices, competitions, and deadlines in one place. Open an event for details and RSVP controls.",
    },
    {
      selector: '[data-tour="opportunities-nav"]',
      title: "Explore opportunities",
      description: "Find applications, tryouts, auditions, and other school opportunities. Student sign-ups are highlighted automatically.",
    },
    ...(canManage && role === "student"
      ? [{
          selector: '[data-tour="manage-nav"]',
          title: "Open your leadership workspace",
          description: "Presidents and Vice Presidents use Manage for club posts, assignments, events, resources, and permitted roster tools.",
        }]
      : []),
    ...(role === "admin"
      ? [{
          selector: '[data-tour="administration-nav"]',
          title: "School administration",
          description: "Open Administration for users, schools, statistics, account requests, and other school-scoped controls.",
        }]
      : []),
    {
      selector: '[data-tour="role-overview"]',
      title: "Start with this overview",
      description:
        role === "student"
          ? "This page summarizes what needs your attention. Student leaders still use it to receive, submit, and review their own assignments."
          : role === "super_admin"
            ? "Choose a school workspace here so every action and statistic remains in the correct scope."
            : "This overview summarizes the clubs and operational work available to your role.",
    },
    {
      selector: '[data-tour="role-checklist"]',
      title: "Follow your launch checklist",
      description: "These tasks are tailored to your role. Open each task to learn the workflow and build your first useful dashboard.",
    },
    {
      selector: '[data-tour="student-clubs"]',
      title: "Your club workspace",
      description: "Open a joined club for its stream, classwork, people directory, resources, and events.",
    },
    {
      selector: '[data-tour="student-classwork"]',
      title: "Keep up with classwork",
      description: "Assignments for Members, Vice Presidents, and Presidents appear here. Open one to submit files, Drive items, links, or completion.",
    },
    {
      selector: '[data-tour="managed-clubs"]',
      title: "Open a club workspace",
      description: "Each managed club has one organized workspace for creating content, reviewing coursework, recording attendance, and maintaining settings.",
    },
    {
      selector: '[data-tour="school-workspaces"]',
      title: "Choose the correct school",
      description: "Platform administrators select a school here before opening its users, clubs, opportunities, or statistics.",
    },
    {
      selector: '[data-tour="notifications"]',
      title: "Watch your notifications",
      description: "Promotions, approvals, grades, club posts, and important activity appear here. The badge shows unread updates.",
    },
    {
      selector: '[data-tour="appearance"]',
      title: "Choose your appearance",
      description: "Switch between light and dark mode here. System mode follows the setting on your device.",
    },
    {
      selector: '[data-tour="settings"]',
      title: "Control your account",
      description: "Settings contains your profile, notifications, Google Drive, appearance, data export, walkthrough replay, and account deletion.",
    },
  ];
}

function findVisibleTarget(selector: string): HTMLElement | null {
  const candidates = [...document.querySelectorAll<HTMLElement>(selector)];
  return candidates.find((element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  }) ?? null;
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

  const moveToAvailableStep = useCallback((requestedIndex: number, direction: 1 | -1 = 1) => {
    let nextIndex = requestedIndex;
    while (nextIndex >= 0 && nextIndex < steps.length) {
      if (findVisibleTarget(steps[nextIndex].selector)) {
        setStepIndex(nextIndex);
        return true;
      }
      nextIndex += direction;
    }
    return false;
  }, [steps]);

  const finish = useCallback(() => {
    try {
      window.localStorage.setItem(storageKey, "complete");
    } catch {
      // The walkthrough should still close when browser storage is unavailable.
    }
    setActive(false);
    setTargetBox(null);
  }, [storageKey]);

  useEffect(() => {
    setMounted(true);
    const forceStart = new URLSearchParams(window.location.search).get("tour") === "1";
    if (forceStart) {
      const url = new URL(window.location.href);
      url.searchParams.delete("tour");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
    let completed = false;
    try {
      completed = window.localStorage.getItem(storageKey) === "complete";
    } catch {
      completed = false;
    }
    if (!forceStart && (!autoStart || completed)) return;

    const timeout = window.setTimeout(() => {
      setActive(true);
      moveToAvailableStep(0);
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [autoStart, moveToAvailableStep, storageKey]);

  useEffect(() => {
    if (!active) return;
    const target = findVisibleTarget(steps[stepIndex].selector);
    if (!target) {
      if (!moveToAvailableStep(stepIndex + 1)) finish();
      return;
    }

    const updatePosition = () => {
      const rect = target.getBoundingClientRect();
      const padding = 8;
      const top = Math.max(8, rect.top - padding);
      const left = Math.max(8, rect.left - padding);
      const width = Math.min(window.innerWidth - left - 8, rect.width + padding * 2);
      const height = Math.min(window.innerHeight - top - 8, rect.height + padding * 2);
      setTargetBox({ top, left, width, height, bottom: top + height });
      setPosition(rect.bottom + 280 < window.innerHeight ? "below" : "above");
    };

    target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    const timeout = window.setTimeout(updatePosition, 250);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [active, finish, moveToAvailableStep, stepIndex, steps]);

  useEffect(() => {
    if (!active || !targetBox) return;
    primaryButtonRef.current?.focus();
  }, [active, stepIndex, targetBox]);

  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
      if (event.key === "ArrowRight") {
        if (!moveToAvailableStep(stepIndex + 1)) finish();
      }
      if (event.key === "ArrowLeft" && stepIndex > 0) {
        moveToAvailableStep(stepIndex - 1, -1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, finish, moveToAvailableStep, stepIndex]);

  if (!mounted || !active || !targetBox) return null;

  const step = steps[stepIndex];
  const visibleStepIndexes = steps
    .map((candidate, index) => findVisibleTarget(candidate.selector) ? index : -1)
    .filter((index) => index >= 0);
  const visiblePosition = Math.max(0, visibleStepIndexes.indexOf(stepIndex));
  const hasNext = visiblePosition < visibleStepIndexes.length - 1;
  const hasPrevious = visiblePosition > 0;
  const tooltipStyle =
    window.innerWidth < 640
      ? { left: 16, right: 16, bottom: 16 }
      : {
          left: Math.min(Math.max(16, targetBox.left), window.innerWidth - 396),
          top: position === "below"
            ? Math.min(targetBox.bottom + 16, window.innerHeight - 280)
            : Math.max(16, targetBox.top - 264),
          width: 380,
        };

  return createPortal(
    <div aria-live="polite">
      <div className="fixed inset-0 z-[70] cursor-default" aria-hidden="true" />
      <div
        className="pointer-events-none fixed z-[80] rounded-xl ring-2 ring-white ring-offset-2 ring-offset-storm-electric transition-all duration-300"
        style={{
          top: targetBox.top,
          left: targetBox.left,
          width: targetBox.width,
          height: targetBox.height,
          boxShadow: "0 0 0 9999px rgb(2 6 23 / 0.72)",
        }}
        aria-hidden="true"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="guided-tour-title"
        aria-describedby="guided-tour-description"
        className="fixed z-[90] overflow-hidden rounded-2xl border border-white/15 bg-card shadow-2xl"
        style={tooltipStyle}
      >
        <div className="bg-storm-gradient px-5 py-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/80">
              <Compass className="h-4 w-4" /> StormHub walkthrough
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
              style={{ width: `${((visiblePosition + 1) / visibleStepIndexes.length) * 100}%` }}
            />
          </div>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-storm-electric">
            Step {visiblePosition + 1} of {visibleStepIndexes.length}
          </p>
          <h2 id="guided-tour-title" className="mt-1 text-xl font-semibold text-storm-navy">
            {step.title}
          </h2>
          <p id="guided-tour-description" className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {step.description}
          </p>
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
                  onClick={() => moveToAvailableStep(stepIndex - 1, -1)}
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
              )}
              <Button
                ref={primaryButtonRef}
                type="button"
                size="sm"
                onClick={() => {
                  if (!hasNext || !moveToAvailableStep(stepIndex + 1)) finish();
                }}
              >
                {hasNext ? <>Next <ArrowRight className="h-4 w-4" /></> : <>Finish <Check className="h-4 w-4" /></>}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}
