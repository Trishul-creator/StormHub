"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { OnboardingItem } from "@/lib/product";

const statusIcon = {
  done: CheckCircle2,
  active: Circle,
  locked: LockKeyhole,
};

export function RoleChecklist({
  title = "Start here",
  description = "A short checklist for the most useful next steps.",
  items,
  progressKey,
  forceManualProgress = false,
}: {
  title?: string;
  description?: string;
  items: OnboardingItem[];
  progressKey?: string;
  forceManualProgress?: boolean;
}) {
  const storageKey = progressKey ? `stormhub:onboarding:${progressKey}` : null;
  const [manualCompleted, setManualCompleted] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!storageKey) return;
    try {
      const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as string[];
      setManualCompleted(new Set(stored));
    } catch {
      setManualCompleted(new Set());
    }
  }, [storageKey]);

  const displayedItems = useMemo(
    () => items.map((item) => ({
      ...item,
      status: item.status === "locked"
        ? "locked" as const
        : manualCompleted.has(item.id)
          ? "done" as const
          : forceManualProgress
            ? "active" as const
            : item.status,
    })),
    [forceManualProgress, items, manualCompleted]
  );
  const completed = displayedItems.filter((item) => item.status === "done").length;

  function recordProgress(itemId: string) {
    if (!storageKey) return;
    setManualCompleted((current) => {
      const next = new Set(current);
      next.add(itemId);
      window.localStorage.setItem(storageKey, JSON.stringify([...next]));
      return next;
    });
  }

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-storm-navy">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="rounded-full bg-storm-light px-3 py-1 text-xs font-medium text-storm-navy">
          {completed}/{displayedItems.length} complete
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {displayedItems.map((item) => {
          const Icon = statusIcon[item.status];
          return (
            <div
              key={item.id}
              className={cn(
                "flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between",
                item.status === "done" && "border-emerald-200 bg-emerald-50/60 dark:border-emerald-800/80 dark:bg-emerald-950/35",
                item.status === "locked" && "bg-muted/40 text-muted-foreground"
              )}
            >
              <div className="flex gap-3">
                <Icon
                  className={cn(
                    "mt-0.5 h-5 w-5 shrink-0",
                    item.status === "done" ? "text-emerald-600 dark:text-emerald-400" : item.status === "active" ? "text-storm-electric" : "text-muted-foreground"
                  )}
                />
                <div>
                  <h3 className="font-medium">{item.label}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
              <Button
                variant={item.status === "done" ? "outline" : "default"}
                size="sm"
                disabled={item.status === "locked"}
                asChild={item.status !== "locked"}
              >
                {item.status === "locked" ? (
                  <span>Locked</span>
                ) : (
                  <Link href={item.href} onClick={() => recordProgress(item.id)}>
                    {item.status === "done" ? "View" : "Open"}
                  </Link>
                )}
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
