import { redirect } from "next/navigation";
import { PolicyAcceptanceForm } from "@/components/auth/policy-acceptance-form";
import { defaultPathForProfile, getAuthContext } from "@/lib/auth";
import { safeAuthRedirectPath } from "@/lib/auth-redirect";
import {
  ACCEPTABLE_USE_VERSION,
  PRIVACY_POLICY_VERSION,
  TERMS_VERSION,
} from "@/lib/policy";
import { createClient } from "@/lib/supabase/server";

interface AcceptPoliciesPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function AcceptPoliciesPage({ searchParams }: AcceptPoliciesPageProps) {
  const auth = await getAuthContext();
  if (!auth.isLoggedIn || !auth.userId || !auth.profile) {
    redirect("/auth/sign-in");
  }
  if (auth.profile.account_status && auth.profile.account_status !== "active") {
    redirect("/account-status");
  }
  if (
    !["district_admin", "super_admin"].includes(auth.profile.role)
    && !auth.profile.school_id
  ) {
    redirect("/auth/complete-profile");
  }

  const supabase = await createClient();
  if (!supabase) redirect("/auth/sign-in");
  const { data: acceptance } = await supabase
    .from("policy_acceptances")
    .select("id")
    .eq("user_id", auth.userId)
    .eq("privacy_version", PRIVACY_POLICY_VERSION)
    .eq("terms_version", TERMS_VERSION)
    .eq("acceptable_use_version", ACCEPTABLE_USE_VERSION)
    .eq("age_assurance", "13_or_older")
    .maybeSingle();

  const params = await searchParams;
  const next = safeAuthRedirectPath(params.next, defaultPathForProfile(auth.profile));
  if (acceptance) redirect(next);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-storm-subtle px-4 py-12">
      <PolicyAcceptanceForm next={next} />
    </div>
  );
}
