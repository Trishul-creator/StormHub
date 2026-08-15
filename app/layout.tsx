import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Toaster } from "@/components/ui/toaster";
import { isDemoMode } from "@/lib/supabase/mode";
import { getAuthContext, hasManagementAccess } from "@/lib/auth";
import { SetupBanner } from "@/components/layout/setup-banner";
import { getUnreadNotificationCount, getUserNotifications } from "@/lib/notifications";
import { getSchoolForProfile } from "@/lib/schools";
import { getDistrictForProfile } from "@/lib/districts";
import { ThemeScript } from "@/components/theme/theme-script";
import { GuidedTour } from "@/components/onboarding/guided-tour";
import { LanguageProvider } from "@/components/i18n/language-provider";
import { getRequestLocale } from "@/lib/i18n/server";
import { getLocaleDirection, translate } from "@/lib/i18n/config";
import { InterfaceTranslator } from "@/components/i18n/interface-translator";

const inter = Inter({ subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return {
    title: translate(locale, "meta.title"),
    description: translate(locale, "meta.description"),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const demoMode = isDemoMode();
  const { isLoggedIn, email: userEmail, profile } = await getAuthContext();
  const [canManage, notifications, unreadNotificationCount, school, district, locale] = await Promise.all([
    hasManagementAccess(profile),
    getUserNotifications(profile?.id ?? null, 5),
    getUnreadNotificationCount(profile?.id ?? null),
    getSchoolForProfile(profile),
    getDistrictForProfile(profile),
    getRequestLocale(),
  ]);
  const tourRelevantAt = profile?.onboarding_reset_at ?? profile?.created_at;
  const tourAccountComplete = Boolean(
    profile
    && (!profile.account_status || profile.account_status === "active")
    && (
      profile.role === "super_admin"
      || (profile.role === "district_admin" ? profile.district_id : profile.school_id)
    )
  );
  const tourAutoStart = Boolean(
    tourAccountComplete
    && tourRelevantAt
    && Date.now() - new Date(tourRelevantAt).getTime() <= 30 * 24 * 60 * 60 * 1000
  );

  return (
    <html lang={locale} dir={getLocaleDirection(locale)} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className={inter.className}>
        <LanguageProvider initialLocale={locale}>
          <InterfaceTranslator />
          <a href="#main-content" className="skip-link">{translate(locale, "common.skipToContent")}</a>
          <Navbar
            isLoggedIn={isLoggedIn}
            userEmail={userEmail ?? undefined}
            isDemoMode={demoMode}
            canManage={canManage}
            role={profile?.role}
            notifications={notifications}
            unreadNotificationCount={unreadNotificationCount}
            schoolSlug={school?.slug}
            districtSlug={district?.slug}
          />
          <SetupBanner role={profile?.role} />
          <main id="main-content" className="min-h-[calc(100vh-4rem)]" tabIndex={-1}>{children}</main>
          <Footer />
          {profile && (
            <GuidedTour
              userId={profile.id}
              role={profile.role}
              canManage={canManage}
              autoStart={tourAutoStart}
              revision={profile.onboarding_reset_at}
            />
          )}
          <Toaster />
        </LanguageProvider>
      </body>
    </html>
  );
}
