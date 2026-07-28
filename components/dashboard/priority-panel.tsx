import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  School,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type {
  DashboardPriorityItem,
  DashboardPriorityKind,
} from "@/lib/dashboard-priorities";

const icons: Record<DashboardPriorityKind, typeof ClipboardList> = {
  assignment: ClipboardList,
  deadline: Timer,
  event: CalendarClock,
  approval: ClipboardCheck,
  grading: GraduationCap,
  school: School,
};

const urgencyStyles = {
  urgent: "border-red-200 bg-red-50/70 text-red-800 dark:border-red-900/70 dark:bg-red-950/35 dark:text-red-200",
  soon: "border-amber-200 bg-amber-50/70 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-200",
  normal: "border-blue-200 bg-blue-50/65 text-blue-800 dark:border-blue-900/70 dark:bg-blue-950/35 dark:text-blue-200",
};

export function DashboardPriorityPanel({
  items,
  title = "Needs your attention",
  description = "The most time-sensitive items across your workspace.",
  allHref,
  allLabel = "View everything",
}: {
  items: DashboardPriorityItem[];
  title?: string;
  description?: string;
  allHref?: string;
  allLabel?: string;
}) {
  return (
    <section data-tour="dashboard-priorities" className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-storm-navy">{title}</h2>
            {items.length > 0 && (
              <span className="rounded-full bg-storm-electric/10 px-2.5 py-0.5 text-xs font-semibold text-storm-electric">
                {items.length}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {allHref && (
          <Button variant="ghost" size="sm" asChild className="self-start sm:self-auto">
            <Link href={allHref}>{allLabel} <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-3 px-5 py-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <div>
            <p className="font-medium text-storm-navy">You’re caught up</p>
            <p className="text-sm text-muted-foreground">Nothing time-sensitive needs action right now.</p>
          </div>
        </div>
      ) : (
        <div className="divide-y">
          {items.map((item) => {
            const Icon = icons[item.kind];
            return (
              <div key={item.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", urgencyStyles[item.urgency])}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h3 className="truncate font-medium text-storm-navy">{item.title}</h3>
                    <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", urgencyStyles[item.urgency])}>
                      {item.timing}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{item.detail}</p>
                </div>
                <Button variant="outline" size="sm" asChild className="self-start sm:self-auto">
                  <Link href={item.href}>{item.actionLabel}</Link>
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
