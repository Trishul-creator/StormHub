import { redirect } from "next/navigation";
import { GoogleOnboardingForm } from "@/components/auth/google-onboarding-form";
import { safeAuthRedirectPath } from "@/lib/auth-redirect";
import { defaultPathForProfile } from "@/lib/auth";
import { getSignupSchools } from "@/lib/schools";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

interface CompleteProfilePageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function CompleteProfilePage({ searchParams }: CompleteProfilePageProps) {
  const supabase = await createClient();
  if (!supabase) redirect("/auth/sign-in");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/auth/sign-in");

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  const profile = data as Profile | null;
  if (profile?.school_id || ["district_admin", "super_admin"].includes(profile?.role ?? "")) {
    redirect(defaultPathForProfile(profile));
  }

  const providers = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers
    : [];
  if (user.app_metadata?.provider !== "google" && !providers.includes("google")) {
    redirect("/auth/sign-in?error=google_onboarding_required");
  }

  const schools = (await getSignupSchools())
    .map((school) => ({ id: school.id, name: school.name }));
  const params = await searchParams;
  const next = safeAuthRedirectPath(params.next);
  const suggestedName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : "";

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-storm-subtle px-4 py-12">
      <GoogleOnboardingForm
        schools={schools}
        email={user.email}
        suggestedName={suggestedName}
        next={next}
      />
    </div>
  );
}
