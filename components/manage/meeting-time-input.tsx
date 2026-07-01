"use client";

import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";

function parseMeetingTime(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized || normalized.toUpperCase() === "TBD") {
    return {
      mode: "tbd" as const,
      startHour: "3",
      startMinute: "00",
      startPeriod: "PM" as const,
      endHour: "4",
      endMinute: "00",
      endPeriod: "PM" as const,
    };
  }

  const match = normalized.match(
    /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)(?:\s*(?:-|–|to)\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM))?$/i
  );
  if (!match) {
    return {
      mode: "tbd" as const,
      startHour: "3",
      startMinute: "00",
      startPeriod: "PM" as const,
      endHour: "4",
      endMinute: "00",
      endPeriod: "PM" as const,
    };
  }

  const startHour = Math.min(Math.max(Number(match[1]), 1), 12).toString();
  const startMinute = match[2] && Number(match[2]) < 60 ? match[2].padStart(2, "0") : "00";
  const startPeriod = match[3].toUpperCase() === "AM" ? "AM" : "PM";
  const endHour = Math.min(Math.max(Number(match[4] || match[1]), 1), 12).toString();
  const endMinute = match[5] && Number(match[5]) < 60 ? match[5].padStart(2, "0") : "00";
  const endPeriod = (match[6] || match[3]).toUpperCase() === "AM" ? "AM" : "PM";
  return {
    mode: "time" as const,
    startHour,
    startMinute,
    startPeriod: startPeriod as "AM" | "PM",
    endHour,
    endMinute,
    endPeriod: endPeriod as "AM" | "PM",
  };
}

interface MeetingTimeInputProps {
  id: string;
  name: string;
  label?: string;
  defaultValue?: string | null;
}

export function MeetingTimeInput({ id, name, label = "Meeting time", defaultValue }: MeetingTimeInputProps) {
  const parsed = useMemo(() => parseMeetingTime(defaultValue), [defaultValue]);
  const [mode, setMode] = useState<"tbd" | "time">(parsed.mode);
  const [startHour, setStartHour] = useState(parsed.startHour);
  const [startMinute, setStartMinute] = useState(parsed.startMinute);
  const [startPeriod, setStartPeriod] = useState<"AM" | "PM">(parsed.startPeriod);
  const [endHour, setEndHour] = useState(parsed.endHour);
  const [endMinute, setEndMinute] = useState(parsed.endMinute);
  const [endPeriod, setEndPeriod] = useState<"AM" | "PM">(parsed.endPeriod);
  const value = mode === "tbd" ? "TBD" : `${startHour}:${startMinute} ${startPeriod} - ${endHour}:${endMinute} ${endPeriod}`;
  const hours = Array.from({ length: 12 }, (_, index) => String(index + 1));
  const minutes = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"));

  return (
    <div>
      <Label htmlFor={`${id}_mode`}>{label}</Label>
      <input type="hidden" id={id} name={name} value={value} />
      <div className="mt-1 space-y-2">
        <select
          id={`${id}_mode`}
          value={mode}
          onChange={(event) => setMode(event.target.value as "tbd" | "time")}
          className="h-10 w-full rounded-lg border bg-white px-3 text-sm"
        >
          <option value="tbd">TBD</option>
          <option value="time">Set time</option>
        </select>
        {mode === "time" && (
          <div className="grid gap-3 rounded-lg border bg-storm-light/20 p-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Start</p>
              <div className="grid grid-cols-3 gap-2">
                <select
                  aria-label="Start hour"
                  value={startHour}
                  onChange={(event) => setStartHour(event.target.value)}
                  className="h-10 min-w-0 rounded-lg border bg-white px-3 text-sm"
                >
                  {hours.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <select
                  aria-label="Start minute"
                  value={startMinute}
                  onChange={(event) => setStartMinute(event.target.value)}
                  className="h-10 min-w-0 rounded-lg border bg-white px-3 text-sm"
                >
                  {minutes.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <select
                  aria-label="Start AM or PM"
                  value={startPeriod}
                  onChange={(event) => setStartPeriod(event.target.value as "AM" | "PM")}
                  className="h-10 min-w-0 rounded-lg border bg-white px-3 text-sm"
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>
            <div className="hidden self-end pb-2 text-sm text-muted-foreground lg:block">to</div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">End</p>
              <div className="grid grid-cols-3 gap-2">
                <select
                  aria-label="End hour"
                  value={endHour}
                  onChange={(event) => setEndHour(event.target.value)}
                  className="h-10 min-w-0 rounded-lg border bg-white px-3 text-sm"
                >
                  {hours.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <select
                  aria-label="End minute"
                  value={endMinute}
                  onChange={(event) => setEndMinute(event.target.value)}
                  className="h-10 min-w-0 rounded-lg border bg-white px-3 text-sm"
                >
                  {minutes.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <select
                  aria-label="End AM or PM"
                  value={endPeriod}
                  onChange={(event) => setEndPeriod(event.target.value as "AM" | "PM")}
                  className="h-10 min-w-0 rounded-lg border bg-white px-3 text-sm"
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
