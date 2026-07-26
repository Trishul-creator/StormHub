import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";
import { Bell, Shield, User } from "lucide-react";
import { NotificationPreferencesForm } from "@/components/notifications/preferences-form";
import { getNotificationPreferences } from "@/lib/notifications";
import { ProfileSettingsForm } from "@/components/settings/profile-settings-form";
import { AccountControls } from "@/components/settings/account-controls";
import { SettingsNavigation } from "@/components/settings/settings-navigation";
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
    <div className="container mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <PageHeader
        title="Settings"
        description="Manage your profile, notifications, privacy, and account."
      />

      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
        <SettingsNavigation />

        <main className="motion-stagger min-w-0 space-y-6">
          <section id="profile" className="scroll-mt-24" aria-labelledby="profile-heading">
            <Card>
              <CardHeader className="border-b bg-storm-light/20">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-storm-electric">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle id="profile-heading">Profile</CardTitle>
                    <CardDescription className="mt-1">
                      Keep the details other members use to recognize you up to date.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <ProfileSettingsForm profile={profile} />
              </CardContent>
            </Card>
          </section>

          <section id="notifications" className="scroll-mt-24" aria-labelledby="notifications-heading">
            <Card>
              <CardHeader className="border-b bg-storm-light/20">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                    <Bell className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle id="notifications-heading">Notifications</CardTitle>
                    <CardDescription className="mt-1">
                      Decide which activity reaches you in StormHub and by email.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <NotificationPreferencesForm initial={preferences} role={profile.role} />
              </CardContent>
            </Card>
          </section>

          <section id="account" className="scroll-mt-24" aria-labelledby="account-heading">
            <Card>
              <CardHeader className="border-b bg-storm-light/20">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle id="account-heading">Account and privacy</CardTitle>
                    <CardDescription className="mt-1">
                      Download your information or request permanent account deletion.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <AccountControls deletionRequest={deletionRequestResult.data ?? null} />
              </CardContent>
            </Card>
          </section>
        </main>
      </div>
    </div>
  );
}
