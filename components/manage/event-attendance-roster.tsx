"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { setClubEventAttendance } from "@/lib/actions";
import { toast } from "@/hooks/use-toast";
import type {
  ClubEventAttendanceEntry,
  ClubEventAttendanceStatus,
} from "@/types/database";

export function EventAttendanceRoster({
  clubSlug,
  eventId,
  entries,
}: {
  clubSlug: string;
  eventId: string;
  entries: ClubEventAttendanceEntry[];
}) {
  const [pending, startTransition] = useTransition();
  const [statuses, setStatuses] = useState<Record<string, ClubEventAttendanceStatus | "">>(
    Object.fromEntries(entries.map((entry) => [entry.user_id, entry.attendance_status ?? ""]))
  );
  const [savingId, setSavingId] = useState<string | null>(null);

  function update(userId: string, status: ClubEventAttendanceStatus | "") {
    const previous = statuses[userId] ?? "";
    setStatuses((current) => ({ ...current, [userId]: status }));
    setSavingId(userId);
    startTransition(async () => {
      const result = await setClubEventAttendance({
        clubSlug,
        eventId,
        userId,
        status: status || null,
      });
      if (!result.success) {
        setStatuses((current) => ({ ...current, [userId]: previous }));
        toast({ title: "Attendance was not saved", description: result.error, variant: "destructive" });
      }
      setSavingId(null);
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      {entries.map((entry) => (
        <div
          key={entry.user_id}
          className="grid gap-3 border-b p-4 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center"
        >
          <div>
            <p className="font-medium text-storm-navy">{entry.full_name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              RSVP: {entry.rsvp_status ? entry.rsvp_status.replace("_", " ") : "No response"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              aria-label={`Attendance for ${entry.full_name}`}
              value={statuses[entry.user_id] ?? ""}
              onChange={(event) => update(
                entry.user_id,
                event.target.value as ClubEventAttendanceStatus | ""
              )}
              disabled={pending && savingId === entry.user_id}
              className="h-9 rounded-md border bg-card px-3 text-sm"
            >
              <option value="">Not marked</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="excused">Excused</option>
            </select>
            <span className="w-5 text-emerald-600">
              {pending && savingId === entry.user_id
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : statuses[entry.user_id] ? <CheckCircle2 className="h-4 w-4" /> : null}
            </span>
          </div>
        </div>
      ))}
      {entries.length === 0 && (
        <p className="p-8 text-center text-sm text-muted-foreground">No student members are on this roster.</p>
      )}
    </div>
  );
}
