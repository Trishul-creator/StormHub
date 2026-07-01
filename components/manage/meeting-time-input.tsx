"use client";

import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";

function parseMeetingTime(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized || normalized.toUpperCase() === "TBD") {
    return { mode: "tbd" as const, hour: "3", minute: "00", period: "PM" as const };
  }

  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match) {
    return { mode: "tbd" as const, hour: "3", minute: "00", period: "PM" as const };
  }

  const hour = Math.min(Math.max(Number(match[1]), 1), 12).toString();
  const minute = match[2] && Number(match[2]) < 60 ? match[2].padStart(2, "0") : "00";
  const period = match[3].toUpperCase() === "AM" ? "AM" : "PM";
  return { mode: "time" as const, hour, minute, period: period as "AM" | "PM" };
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
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const [period, setPeriod] = useState<"AM" | "PM">(parsed.period);
  const value = mode === "tbd" ? "TBD" : `${hour}:${minute} ${period}`;

  return (
    <div>
      <Label htmlFor={`${id}_mode`}>{label}</Label>
      <input type="hidden" id={id} name={name} value={value} />
      <div className="mt-1 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
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
          <div className="grid grid-cols-3 gap-2">
            <select
              aria-label="Hour"
              value={hour}
              onChange={(event) => setHour(event.target.value)}
              className="h-10 rounded-lg border bg-white px-3 text-sm"
            >
              {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <select
              aria-label="Minute"
              value={minute}
              onChange={(event) => setMinute(event.target.value)}
              className="h-10 rounded-lg border bg-white px-3 text-sm"
            >
              {Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0")).map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <select
              aria-label="AM or PM"
              value={period}
              onChange={(event) => setPeriod(event.target.value as "AM" | "PM")}
              className="h-10 rounded-lg border bg-white px-3 text-sm"
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
