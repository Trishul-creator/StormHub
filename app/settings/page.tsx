import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";
import { Bell, Cloud, Compass, Languages, Palette, Shield, User } from "lucide-react";
import { NotificationPreferencesForm } from "@/components/notifications/preferences-form";
import { getNotificationPreferences } from "@/lib/notifications";
import { ProfileSettingsForm } from "@/components/settings/profile-settings-form";
import { AccountControls } from "@/components/settings/account-controls";
import { SettingsNavigation } from "@/components/settings/settings-navigation";
import { createClient } from "@/lib/supabase/server";
import { getGoogleDriveConnectionStatus } from "@/lib/google-drive";
import { GoogleDriveSettings } from "@/components/settings/google-drive-settings";
import { ThemeSettings } from "@/components/theme/theme-controls";
import { GuidedTourSettings } from "@/components/settings/guided-tour-settings";
import { LanguageSettings } from "@/components/i18n/language-controls";
import { getServerTranslator } from "@/lib/i18n/server";

export default async function SettingsPage() {
  const { profile } = await requireAuth("/settings");
  const { t } = await getServerTranslator();
  const supabase = await createClient();
  const [preferences, deletionRequestResult, googleDriveStatus] = await Promise.all([
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
    getGoogleDriveConnectionStatus(profile.id).catch(() => ({
      configured: false,
      connected: false,
    })),
  ]);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <PageHeader
        title={t("settings.title")}
        description={t("settings.description")}
      />

      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
        <SettingsNavigation />

        <div data-tour="settings-content" className="motion-stagger min-w-0 space-y-6">
          <section id="profile" className="scroll-mt-24" aria-labelledby="profile-heading">
            <Card>
              <CardHeader className="border-b bg-storm-light/20">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-storm-electric">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 id="profile-heading" className="font-semibold leading-none tracking-tight">{t("settings.profile")}</h2>
                    <CardDescription className="mt-1">
                      {t("settings.profileDescription")}
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
                    <h2 id="notifications-heading" className="font-semibold leading-none tracking-tight">{t("settings.notifications")}</h2>
                    <CardDescription className="mt-1">
                      {t("settings.notificationsDescription")}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <NotificationPreferencesForm initial={preferences} role={profile.role} />
              </CardContent>
            </Card>
          </section>

          <section id="integrations" className="scroll-mt-24" aria-labelledby="integrations-heading">
            <Card>
              <CardHeader className="border-b bg-storm-light/20">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-storm-electric">
                    <Cloud className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 id="integrations-heading" className="font-semibold leading-none tracking-tight">{t("settings.integrations")}</h2>
                    <CardDescription className="mt-1">
                      {t("settings.integrationsDescription")}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <GoogleDriveSettings status={googleDriveStatus} />
              </CardContent>
            </Card>
          </section>

          <section id="appearance" className="scroll-mt-24" aria-labelledby="appearance-heading">
            <Card>
              <CardHeader className="border-b bg-storm-light/20">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                    <Palette className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 id="appearance-heading" className="font-semibold leading-none tracking-tight">{t("settings.appearance")}</h2>
                    <CardDescription className="mt-1">
                      {t("settings.appearanceDescription")}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <ThemeSettings />
              </CardContent>
            </Card>
          </section>

          <section id="language" className="scroll-mt-24" aria-labelledby="language-heading">
            <Card>
              <CardHeader className="border-b bg-storm-light/20">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                    <Languages className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 id="language-heading" className="font-semibold leading-none tracking-tight">{t("language.interface")}</h2>
                    <CardDescription className="mt-1">
                      {t("language.description")}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <LanguageSettings />
              </CardContent>
            </Card>
          </section>

          <section id="walkthrough" className="scroll-mt-24" aria-labelledby="walkthrough-heading">
            <Card>
              <CardHeader className="border-b bg-storm-light/20">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-storm-electric dark:bg-blue-950/60 dark:text-blue-300">
                    <Compass className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 id="walkthrough-heading" className="font-semibold leading-none tracking-tight">{t("settings.walkthroughTitle")}</h2>
                    <CardDescription className="mt-1">
                      {t("settings.walkthroughDescription")}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <GuidedTourSettings role={profile.role} />
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
                    <h2 id="account-heading" className="font-semibold leading-none tracking-tight">{t("settings.accountTitle")}</h2>
                    <CardDescription className="mt-1">
                      {t("settings.accountDescription")}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <AccountControls deletionRequest={deletionRequestResult.data ?? null} />
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
