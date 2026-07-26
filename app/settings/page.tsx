import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";
import { User } from "lucide-react";
import { Bell } from "lucide-react";
import { NotificationPreferencesForm } from "@/components/notifications/preferences-form";
import { getNotificationPreferences } from "@/lib/notifications";
import { ProfileSettingsForm } from "@/components/settings/profile-settings-form";
import { AccountControls } from "@/components/settings/account-controls";
import { Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const { profile } = await requireAuth("/settings");
  const supabase = await createClient();
  const [preferences, deletionRequestResult] = await Promise.all([
    getNotificationPreferences(profile.id),
    supabase
      ? supabase
          .from("account_deletion_requests")
          .select("status,requested_at,reviewer_notes")
          .eq("user_id", profile.id)
          .order("requested_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="motion-stagger container mx-auto max-w-2xl px-4 py-8">
      <PageHeader title="Settings" description="Manage your StormHub profile." />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProfileSettingsForm profile={profile} />
          <p className="text-xs text-muted-foreground">
            StormHub collects only what is needed for club participation. No grades or sensitive data is stored.
          </p>
        </CardContent>
      </Card>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <NotificationPreferencesForm initial={preferences} role={profile.role} />
        </CardContent>
      </Card>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Account and privacy</CardTitle>
        </CardHeader>
        <CardContent>
          <AccountControls deletionRequest={deletionRequestResult.data ?? null} />
        </CardContent>
      </Card>
    </div>
  );
}
