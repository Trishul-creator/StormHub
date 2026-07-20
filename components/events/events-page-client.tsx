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
import type { Event } from "@/types/database";
import { EVENT_TYPES } from "@/lib/utils";

interface EventsPageClientProps {
  events: Event[];
  deadlines: Event[];
  isLoggedIn: boolean;
  rsvpIds: string[];
  userClubIds: string[];
  canParticipate: boolean;
}

type SourceFilter = "all" | "clubs" | "school";
type View = "calendar" | "agenda";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const eventColors: Record<string, string> = {
  meeting: "border-blue-200 bg-blue-50 text-blue-800",
  practice: "border-cyan-200 bg-cyan-50 text-cyan-800",
  workshop: "border-violet-200 bg-violet-50 text-violet-800",
  competition: "border-amber-200 bg-amber-50 text-amber-900",
  audition: "border-pink-200 bg-pink-50 text-pink-800",
  info_session: "border-emerald-200 bg-emerald-50 text-emerald-800",
  deadline: "border-red-200 bg-red-50 text-red-800",
  other: "border-slate-200 bg-slate-50 text-slate-800",
};

function CalendarEvent({
  event,
  hasRsvp = false,
  compact = false,
}: {
  event: Event;
  hasRsvp?: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      href={`/events/${event.id}`}
      title={`${format(parseISO(event.starts_at), "h:mm a")} — ${event.title}`}
      className={cn(
        "block truncate rounded-md border px-1.5 py-1 text-[11px] font-medium leading-tight transition hover:-translate-y-px hover:shadow-sm",
        eventColors[event.event_type] ?? eventColors.other,
        hasRsvp && "border-green-300 bg-green-100 text-green-900 ring-1 ring-green-400",
        compact && "px-1 py-0.5 text-[10px]"
      )}
    >
      <span className="mr-1">{format(parseISO(event.starts_at), "h:mm")}</span>
      {event.title}
    </Link>
  );
}

export function EventsPageClient({
  events,
  deadlines,
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

  const filtered = useMemo(
    () =>
      events.filter((event) => {
        if (typeFilter && event.event_type !== typeFilter) return false;
        const isMyClubEvent = Boolean(event.club_id && clubIdSet.has(event.club_id));
        if (sourceFilter === "clubs" && !isMyClubEvent) return false;
        if (sourceFilter === "school" && event.club_id) return false;
        return true;
      }),
    [clubIdSet, events, sourceFilter, typeFilter]
  );

  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(visibleMonth)),
    end: endOfWeek(endOfMonth(visibleMonth)),
  });

  const selectedEvents = filtered.filter((event) =>
    isSameDay(parseISO(event.starts_at), selectedDay)
  );
  const monthEvents = filtered.filter((event) =>
    isSameMonth(parseISO(event.starts_at), visibleMonth)
  );
  const upcomingDeadlines = deadlines
    .filter((event) => parseISO(event.starts_at) >= new Date())
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
      <div className="rounded-2xl border bg-white p-3 shadow-sm sm:p-4">
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
                        ? "bg-white text-storm-navy shadow-sm"
                        : "text-muted-foreground hover:text-storm-navy"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div className="flex rounded-lg border bg-white p-1">
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
                : "bg-white text-muted-foreground"
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
                  : "bg-white text-muted-foreground"
              )}
            >
              {type.replaceAll("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {view === "calendar" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
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
                const dayEvents = filtered.filter((event) =>
                  isSameDay(parseISO(event.starts_at), day)
                );
                const selected = isSameDay(day, selectedDay);
                const hasRsvpEvent = dayEvents.some((event) => rsvpSet.has(event.id));
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "min-h-24 border-b border-r p-1.5 text-left align-top transition hover:bg-storm-light/30 sm:min-h-32 sm:p-2",
                      !isSameMonth(day, visibleMonth) && "bg-slate-50/70 text-muted-foreground",
                      hasRsvpEvent && "bg-green-50/70",
                      selected && "bg-blue-50/70 ring-2 ring-inset ring-storm-electric/40"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedDay(day)}
                      aria-label={`Show events for ${format(day, "MMMM d, yyyy")}`}
                      aria-pressed={selected}
                      aria-current={isToday(day) ? "date" : undefined}
                      className={cn(
                        "mb-1.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                        isToday(day) && "bg-storm-electric text-white",
                        selected && !isToday(day) && "bg-storm-navy text-white"
                      )}
                    >
                      {format(day, "d")}
                    </button>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <CalendarEvent
                          key={event.id}
                          event={event}
                          hasRsvp={rsvpSet.has(event.id)}
                          compact={calendarDays.length > 35}
                        />
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="px-1 text-[10px] font-medium text-muted-foreground">
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
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
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
                  selectedEvents.map((event) => {
                    const isMyClub = Boolean(
                      event.club_id && clubIdSet.has(event.club_id)
                    );
                    return (
                      <Link
                        key={event.id}
                        href={`/events/${event.id}`}
                        className="block rounded-xl border p-3 transition hover:border-storm-electric/40 hover:shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-storm-navy">
                            {event.title}
                          </p>
                          <EventTypeBadge type={event.event_type} />
                        </div>
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          <p className="flex items-center gap-1.5">
                            <Clock3 className="h-3.5 w-3.5" />
                            {format(parseISO(event.starts_at), "h:mm a")}
                          </p>
                          {event.location && (
                            <p className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5" />
                              {event.location}
                            </p>
                          )}
                          <p className="flex items-center gap-1.5">
                            {event.club ? (
                              <Users className="h-3.5 w-3.5" />
                            ) : (
                              <School className="h-3.5 w-3.5" />
                            )}
                            {event.club?.name ?? "School-wide"}
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
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <h3 className="font-semibold text-amber-950">Upcoming deadlines</h3>
                <div className="mt-3 space-y-3">
                  {upcomingDeadlines.map((deadline) => (
                    <Link
                      key={deadline.id}
                      href={`/events/${deadline.id}`}
                      className="block text-sm text-amber-900 hover:underline"
                    >
                      <span className="font-medium">{deadline.title}</span>
                      <span className="block text-xs text-amber-700">
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
            <div className="rounded-2xl border border-dashed bg-white p-12 text-center text-muted-foreground">
              No calendar items match these filters in {format(visibleMonth, "MMMM")}.
            </div>
          ) : (
            Array.from(
              new Set(monthEvents.map((event) => format(parseISO(event.starts_at), "yyyy-MM-dd")))
            ).map((dateKey) => {
              const dayEvents = monthEvents.filter(
                (event) => format(parseISO(event.starts_at), "yyyy-MM-dd") === dateKey
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
                    {dayEvents.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        isLoggedIn={isLoggedIn}
                        hasRsvp={rsvpSet.has(event.id)}
                        canParticipate={canParticipate}
                      />
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
