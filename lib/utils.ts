import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function humanizeLabel(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function opportunityActionLabel(label: string | null | undefined): string {
  const normalized = (label ?? "").trim();
  if (!normalized) return "Sign Up";
  if (normalized.toLowerCase() === "rsvp") return "Sign Up";
  return humanizeLabel(normalized);
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "TBD";
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "MMM d, yyyy");
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "TBD";
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "MMM d, yyyy 'at' h:mm a");
}

export function formatRelative(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function formatEventDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isToday(d)) return `Today at ${format(d, "h:mm a")}`;
  if (isTomorrow(d)) return `Tomorrow at ${format(d, "h:mm a")}`;
  return formatDateTime(d);
}

export function isDeadlineSoon(date: string | Date | null | undefined, days = 7): boolean {
  if (!date) return false;
  const d = typeof date === "string" ? new Date(date) : date;
  if (isPast(d)) return false;
  const diff = d.getTime() - Date.now();
  return diff <= days * 24 * 60 * 60 * 1000;
}

export function isOverdue(date: string | Date | null | undefined): boolean {
  if (!date) return false;
  const d = typeof date === "string" ? new Date(date) : date;
  return isPast(d);
}

export const OPPORTUNITY_CATEGORIES = [
  "Competition",
  "Tryout",
  "Application",
  "Audition",
  "Workshop",
  "Deadline",
  "Interest Form",
  "Other",
] as const;

export const CLUB_FILTER_GROUPS = [
  { label: "STEM", categories: ["Science", "Math", "Engineering"] },
  { label: "Music/Arts", categories: ["Music", "Arts"] },
  { label: "Service", categories: ["Service"] },
  { label: "Leadership", categories: ["Leadership"] },
  { label: "Competition", categories: ["Competition"] },
  { label: "Language/Culture", categories: ["Language/Culture"] },
] as const;

export const EVENT_TYPES = [
  "meeting",
  "practice",
  "info_session",
  "competition",
  "workshop",
  "audition",
  "deadline",
  "other",
] as const;

export const SCHOOL_NAME = "Elkhorn South High School";
export const SCHOOL_SLUG = "elkhorn-south";
export const APP_NAME = "StormHub";
