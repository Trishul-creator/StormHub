"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { updateNotificationPreferences } from "@/lib/actions";
import type { NotificationPreferences, UserRole } from "@/types/database";

type PreferenceValues = Omit<NotificationPreferences, "id" | "user_id" | "created_at" | "updated_at">;

export function NotificationPreferencesForm({
  initial,
  role,
}: {
  initial: NotificationPreferences;
  role: UserRole;
}) {
  const [values, setValues] = useState<PreferenceValues>({
    in_app_enabled: initial.in_app_enabled,
    club_updates_enabled: initial.club_updates_enabled,
    opportunity_deadlines_enabled: initial.opportunity_deadlines_enabled,
    important_email_enabled: initial.important_email_enabled,
    urgent_email_enabled: initial.urgent_email_enabled,
    admin_attention_email_enabled: initial.admin_attention_email_enabled,
    weekly_digest_enabled: initial.weekly_digest_enabled,
  });
  const [pending, startTransition] = useTransition();
  const isAdmin = role === "admin" || role === "super_admin";

  function option(key: keyof PreferenceValues, label: string, description: string, disabled = false) {
    return (
      <label className={`flex items-start justify-between gap-4 rounded-lg border p-3 ${disabled ? "opacity-60" : ""}`}>
        <span>
          <span className="block text-sm font-medium text-storm-navy">{label}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
        </span>
        <input
          type="checkbox"
          checked={values[key]}
          disabled={disabled}
          onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.checked }))}
          className="mt-1 h-4 w-4"
        />
      </label>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-storm-light/40 p-3 text-sm text-muted-foreground">
        Normal updates stay inside StormHub. Important and urgent updates may also be sent by email.
        Email sending requires an email provider to be configured; currently messages are queued only.
      </div>
      {option("in_app_enabled", "In-app notifications", "Show notification updates inside StormHub.")}
      {!isAdmin && option("club_updates_enabled", "Club updates", "Announcements and calendar changes from clubs you joined.")}
      {role === "student" && option("opportunity_deadlines_enabled", "Opportunity deadline reminders", "Reminders for saved opportunities that are closing soon.")}
      {option("important_email_enabled", isAdmin ? "Important system/admin notifications" : "Important email notifications", "Allow email queue items for important updates when the sender requests email.")}
      {option("urgent_email_enabled", isAdmin ? "Urgent system/admin notifications" : "Urgent email notifications", "Urgent updates are queued for email by default.")}
      {isAdmin && option("admin_attention_email_enabled", "Admin attention emails", "Queue email for items that require administrator action.")}
      {option("weekly_digest_enabled", "Weekly digest", "Receive the school summary by email each Monday. You can preview the current digest at any time.")}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          disabled={pending}
          onClick={() => startTransition(async () => {
            const result = await updateNotificationPreferences(values);
            toast({
              title: result.success ? "Preferences saved" : "Could not save preferences",
              description: result.error,
              variant: result.success ? "default" : "destructive",
            });
          })}
        >
          {pending ? "Saving..." : "Save notification preferences"}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/digest"><Eye className="h-4 w-4" /> View weekly digest</Link>
        </Button>
      </div>
    </div>
  );
}
