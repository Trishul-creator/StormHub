"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  List,
  MapPin,
  School,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/events/event-card";
import { EventTypeBadge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { Event, Opportunity } from "@/types/database";
import { EVENT_TYPES } from "@/lib/utils";

interface EventsPageClientProps {
  events: Event[];
  opportunities: Opportunity[];
  isLoggedIn: boolean;
  rsvpIds: string[];
  userClubIds: string[];
  canParticipate: boolean;
}

type SourceFilter = "all" | "clubs" | "school";
type View = "calendar" | "agenda";
type CalendarItem = {
  id: string;
  kind: "event" | "opportunity";
  title: string;
  starts_at: string;
  event_type: Event["event_type"];
  href: string;
  dateLabel?: "Opportunity" | "Deadline";
  description?: string | null;
  location?: string | null;
  club_id?: string | null;
  club?: Event["club"];
  event?: Event;
};

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const eventColors: Record<string, string> = {
  meeting: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/70 dark:text-blue-200",
  practice: "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950/70 dark:text-cyan-200",
  workshop: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/70 dark:text-violet-200",
  competition: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-200",
  audition: "border-pink-200 bg-pink-50 text-pink-800 dark:border-pink-800 dark:bg-pink-950/70 dark:text-pink-200",
  info_session: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200",
  deadline: "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/70 dark:text-red-200",
  other: "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200",
};

function CalendarEvent({
  item,
  hasRsvp = false,
  compact = false,
}: {
  item: CalendarItem;
  hasRsvp?: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      href={item.href}
      title={`${format(parseISO(item.starts_at), "h:mm a")} — ${item.title}`}
      className={cn(
        "block truncate rounded-md border px-1.5 py-1 text-[11px] font-medium leading-tight transition hover:-translate-y-px hover:shadow-sm",
        eventColors[item.event_type] ?? eventColors.other,
        hasRsvp && "border-green-300 bg-green-100 text-green-900 ring-1 ring-green-400 dark:border-green-700 dark:bg-green-950/70 dark:text-green-200 dark:ring-green-700",
        compact && "px-1 py-0.5 text-[10px]"
      )}
    >
      <span className="mr-1">{format(parseISO(item.starts_at), "h:mm")}</span>
      {item.title}
    </Link>
  );
}

export function EventsPageClient({
  events,
  opportunities,
  isLoggedIn,
  rsvpIds,
  userClubIds,
  canParticipate,
}: EventsPageClientProps) {
  const [view, setView] = useState<View>("calendar");
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [typeFilter, setTypeFilter] = useState<string>();
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  const clubIdSet = useMemo(() => new Set(userClubIds), [userClubIds]);
  const rsvpSet = useMemo(() => new Set(rsvpIds), [rsvpIds]);

  const calendarItems = useMemo<CalendarItem[]>(() => [
    ...events.map((event) => ({
      id: event.id,
      kind: "event" as const,
      title: event.title,
      starts_at: event.starts_at,
      event_type: event.event_type,
      href: `/events/${event.id}`,
      description: event.description,
      location: event.location,
      club_id: event.club_id,
      club: event.club,
      event,
    })),
    ...opportunities.flatMap((opportunity): CalendarItem[] => {
      const shared = {
        kind: "opportunity" as const,
        href: `/opportunities/${opportunity.slug}`,
        description: opportunity.summary,
        club_id: opportunity.club_id,
      };
      return [
        ...(opportunity.event_date ? [{
          ...shared,
          id: `opportunity-${opportunity.id}-date`,
          title: opportunity.title,
          starts_at: opportunity.event_date,
          event_type: "other" as const,
          dateLabel: "Opportunity" as const,
          location: opportunity.location,
        }] : []),
        ...(opportunity.deadline ? [{
          ...shared,
          id: `opportunity-${opportunity.id}-deadline`,
          title: `${opportunity.title} deadline`,
          starts_at: opportunity.deadline,
          event_type: "deadline" as const,
          dateLabel: "Deadline" as const,
        }] : []),
      ];
    }),
  ], [events, opportunities]);

  const filtered = useMemo(
    () =>
      calendarItems.filter((item) => {
        if (typeFilter && item.event_type !== typeFilter) return false;
        const isMyClubEvent = Boolean(item.club_id && clubIdSet.has(item.club_id));
        if (sourceFilter === "clubs" && !isMyClubEvent) return false;
        if (sourceFilter === "school" && item.club_id) return false;
        return true;
      }),
    [calendarItems, clubIdSet, sourceFilter, typeFilter]
  );

  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(visibleMonth)),
    end: endOfWeek(endOfMonth(visibleMonth)),
  });

  const selectedEvents = filtered.filter((item) =>
    isSameDay(parseISO(item.starts_at), selectedDay)
  );
  const monthEvents = filtered.filter((item) =>
    isSameMonth(parseISO(item.starts_at), visibleMonth)
  );
  const upcomingDeadlines = calendarItems
    .filter((item) => item.event_type === "deadline" && parseISO(item.starts_at) >= new Date())
    .sort((a, b) => parseISO(a.starts_at).getTime() - parseISO(b.starts_at).getTime())
    .slice(0, 3);

  function changeMonth(nextMonth: Date) {
    setVisibleMonth(nextMonth);
    setSelectedDay(startOfMonth(nextMonth));
  }

  function goToToday() {
    const today = new Date();
    setVisibleMonth(startOfMonth(today));
    setSelectedDay(today);
  }

  return (
    <div className="space-y-6">
      <div data-tour="calendar-toolbar" className="rounded-2xl border bg-card p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => changeMonth(subMonths(visibleMonth, 1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => changeMonth(addMonths(visibleMonth, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <h2 className="ml-1 min-w-44 text-xl font-bold text-storm-navy">
              {format(visibleMonth, "MMMM yyyy")}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isLoggedIn && (
              <div className="flex rounded-lg bg-muted p-1">
                {([
                  ["all", "Everything"],
                  ["clubs", "My clubs"],
                  ["school", "School-wide"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setSourceFilter(value)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-medium transition",
                      sourceFilter === value
                        ? "bg-card text-storm-navy shadow-sm"
                        : "text-muted-foreground hover:text-storm-navy"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div className="flex rounded-lg border bg-card p-1">
              <button
                onClick={() => setView("calendar")}
                className={cn(
                  "flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium",
                  view === "calendar" && "bg-storm-navy text-white"
                )}
              >
                <CalendarDays className="h-3.5 w-3.5" /> Month
              </button>
              <button
                onClick={() => setView("agenda")}
                className={cn(
                  "flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium",
                  view === "agenda" && "bg-storm-navy text-white"
                )}
              >
                <List className="h-3.5 w-3.5" /> Agenda
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setTypeFilter(undefined)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-medium",
              !typeFilter
                ? "border-storm-electric bg-storm-electric text-white"
                : "bg-card text-muted-foreground"
            )}
          >
            All types
          </button>
          {EVENT_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(typeFilter === type ? undefined : type)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-medium capitalize",
                typeFilter === type
                  ? "border-storm-electric bg-storm-electric text-white"
                  : "bg-card text-muted-foreground"
              )}
            >
              {type.replaceAll("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {view === "calendar" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div data-tour="calendar-grid" className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="grid grid-cols-7 border-b bg-storm-navy">
              {weekdayLabels.map((day) => (
                <div
                  key={day}
                  className="px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-white/75 sm:px-3 sm:text-xs"
                >
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((day) => {
                const dayEvents = filtered.filter((item) =>
                  isSameDay(parseISO(item.starts_at), day)
                );
                const selected = isSameDay(day, selectedDay);
                const hasRsvpEvent = dayEvents.some((item) => item.kind === "event" && rsvpSet.has(item.id));
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "relative min-h-24 border-b border-r p-1.5 text-left align-top transition hover:bg-storm-light/30 sm:min-h-32 sm:p-2",
                      !isSameMonth(day, visibleMonth) && "bg-muted/55 text-muted-foreground",
                      hasRsvpEvent && "bg-emerald-50/70 dark:bg-emerald-950/35",
                      selected && "bg-blue-50/70 ring-2 ring-inset ring-storm-electric/40 dark:bg-blue-950/40"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedDay(day)}
                      aria-label={`Show events for ${format(day, "MMMM d, yyyy")}`}
                      aria-pressed={selected}
                      aria-current={isToday(day) ? "date" : undefined}
                      className="absolute inset-0 z-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-storm-electric"
                    />
                    <div
                      className={cn(
                        "pointer-events-none relative z-10 mb-1.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                        isToday(day) && "bg-storm-electric text-white",
                        selected && !isToday(day) && "bg-storm-navy text-white"
                      )}
                    >
                      {format(day, "d")}
                    </div>
                    <div className="relative z-10 space-y-1">
                      {dayEvents.slice(0, 3).map((item) => (
                        <CalendarEvent
                          key={item.id}
                          item={item}
                          hasRsvp={item.kind === "event" && rsvpSet.has(item.id)}
                          compact={calendarDays.length > 35}
                        />
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="pointer-events-none px-1 text-[10px] font-medium text-muted-foreground">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-storm-electric">
                    Selected day
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-storm-navy">
                    {format(selectedDay, "EEEE, MMMM d")}
                  </h3>
                </div>
                <div className="rounded-xl bg-storm-light px-3 py-2 text-center">
                  <div className="text-xl font-bold text-storm-navy">{selectedEvents.length}</div>
                  <div className="text-[10px] uppercase text-muted-foreground">items</div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {selectedEvents.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Nothing scheduled for this day.
                  </div>
                ) : (
                  selectedEvents.map((item) => {
                    const isMyClub = Boolean(
                      item.club_id && clubIdSet.has(item.club_id)
                    );
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        className="block rounded-xl border p-3 transition hover:border-storm-electric/40 hover:shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-storm-navy">
                            {item.title}
                          </p>
                          {item.dateLabel ? (
                            <span className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                              item.dateLabel === "Deadline"
                                ? "bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-200"
                                : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                            )}>
                              {item.dateLabel}
                            </span>
                          ) : (
                            <EventTypeBadge type={item.event_type} />
                          )}
                        </div>
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          <p className="flex items-center gap-1.5">
                            <Clock3 className="h-3.5 w-3.5" />
                            {format(parseISO(item.starts_at), "h:mm a")}
                          </p>
                          {item.location && (
                            <p className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5" />
                              {item.location}
                            </p>
                          )}
                          <p className="flex items-center gap-1.5">
                            {item.club ? (
                              <Users className="h-3.5 w-3.5" />
                            ) : (
                              <School className="h-3.5 w-3.5" />
                            )}
                            {item.club?.name ?? (item.kind === "opportunity" ? "Opportunity" : "School-wide")}
                            {isMyClub && " · Your club"}
                          </p>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>

            {upcomingDeadlines.length > 0 && (
              <div className="accent-surface-amber rounded-2xl border border-amber-200 p-5 dark:border-amber-900/70">
                <h3 className="font-semibold text-storm-navy">Upcoming deadlines</h3>
                <div className="mt-3 space-y-3">
                  {upcomingDeadlines.map((deadline) => (
                    <Link
                      key={deadline.id}
                      href={deadline.href}
                      className="block text-sm text-foreground hover:text-storm-electric hover:underline"
                    >
                      <span className="font-medium">{deadline.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {format(parseISO(deadline.starts_at), "MMM d, h:mm a")}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      ) : (
        <div className="space-y-6">
          {monthEvents.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-card p-12 text-center text-muted-foreground">
              No calendar items match these filters in {format(visibleMonth, "MMMM")}.
            </div>
          ) : (
            Array.from(
              new Set(monthEvents.map((item) => format(parseISO(item.starts_at), "yyyy-MM-dd")))
            ).map((dateKey) => {
              const dayEvents = monthEvents.filter(
                (item) => format(parseISO(item.starts_at), "yyyy-MM-dd") === dateKey
              );
              return (
                <section key={dateKey}>
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-storm-navy text-white">
                      <span className="text-[10px] uppercase">
                        {format(parseISO(dateKey), "MMM")}
                      </span>
                      <span className="text-lg font-bold leading-none">
                        {format(parseISO(dateKey), "d")}
                      </span>
                    </div>
                    <h3 className="font-semibold text-storm-navy">
                      {format(parseISO(dateKey), "EEEE")}
                    </h3>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {dayEvents.map((item) => item.event ? (
                        <EventCard
                          key={item.id}
                          event={item.event}
                          isLoggedIn={isLoggedIn}
                          hasRsvp={rsvpSet.has(item.id)}
                          canParticipate={canParticipate}
                        />
                      ) : (
                        <Link
                          key={item.id}
                          href={item.href}
                          className="rounded-xl border bg-card p-5 transition hover:border-storm-electric/40 hover:shadow-md"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-semibold text-storm-navy">{item.title}</h4>
                            <span className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                              item.dateLabel === "Deadline"
                                ? "bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-200"
                                : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                            )}>
                              {item.dateLabel}
                            </span>
                          </div>
                          {item.description && (
                            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                              {item.description}
                            </p>
                          )}
                          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                            <p className="flex items-center gap-1.5">
                              <Clock3 className="h-3.5 w-3.5" />
                              {format(parseISO(item.starts_at), "h:mm a")}
                            </p>
                            {item.location && (
                              <p className="flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5" />
                                {item.location}
                              </p>
                            )}
                          </div>
                        </Link>
                      ))}
                  </div>
                </section>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
