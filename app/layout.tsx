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
import { ThemeScript } from "@/components/theme/theme-script";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "StormHub — Student Opportunity Hub",
  description: "Discover clubs, events, applications, tryouts, auditions, and deadlines at your school.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const demoMode = isDemoMode();
  const { isLoggedIn, email: userEmail, profile } = await getAuthContext();
  const [canManage, notifications, unreadNotificationCount, school] = await Promise.all([
    hasManagementAccess(profile),
    getUserNotifications(profile?.id ?? null, 5),
    getUnreadNotificationCount(profile?.id ?? null),
    getSchoolForProfile(profile),
  ]);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className={inter.className}>
        <a href="#main-content" className="skip-link">Skip to content</a>
        <Navbar
          isLoggedIn={isLoggedIn}
          userEmail={userEmail ?? undefined}
          isDemoMode={demoMode}
          canManage={canManage}
          role={profile?.role}
          notifications={notifications}
          unreadNotificationCount={unreadNotificationCount}
          schoolSlug={school?.slug}
        />
        <SetupBanner />
        <main id="main-content" className="min-h-[calc(100vh-4rem)]" tabIndex={-1}>{children}</main>
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}
