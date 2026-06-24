import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/supabase/mode";
import type { Profile, UserRole } from "@/types/database";
import { SCHOOL_SLUG } from "@/lib/utils";
import {
  canAccessAdmin,
  canAccessManage,
  canAccessManageAnalytics,
  canApproveContent,
  canManageClub,
} from "@/lib/permissions";
import type { Club, ClubMembership } from "@/types/database";

const DEMO_USER_COOKIE = "stormhub_demo_user";
const DEMO_EMAIL_COOKIE = "stormhub_demo_email";

function demoRoleForEmail(email: string | null): UserRole {
  return email?.toLowerCase().startsWith("admin") ? "admin" : "student";
}

export interface AuthContext {
  userId: string | null;
  profile: Profile | null;
  isLoggedIn: boolean;
  email: string | null;
  isDemo: boolean;
}

export async function getDemoUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(DEMO_USER_COOKIE)?.value ?? null;
}

export async function getDemoEmail(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(DEMO_EMAIL_COOKIE)?.value ?? null;
}

export async function getAuthUserId(): Promise<string | null> {
  if (isDemoMode()) {
    return getDemoUserId();
  }
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function createProfileIfMissing(
  userId: string,
  email: string,
  fullName?: string
): Promise<Profile | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (existing) return existing as Profile;

  const { data: school } = await supabase
    .from("schools")
    .select("id")
    .eq("slug", SCHOOL_SLUG)
    .maybeSingle();

  const { data: created, error } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      email,
      full_name: fullName || email.split("@")[0],
      school_id: school?.id ?? null,
      role: "student",
    })
    .select("*")
    .single();

  if (error) {
    // Race with trigger — fetch again
    const { data: retry } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    return (retry as Profile) ?? null;
  }
  return created as Profile;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  if (isDemoMode()) {
    const userId = await getDemoUserId();
    if (!userId) return null;
    const email = await getDemoEmail();
    return {
      id: userId,
      email: email ?? "demo@example.com",
      full_name: email?.split("@")[0] ?? "Demo Student",
      role: demoRoleForEmail(email),
      school_id: "a0000000-0000-4000-8000-000000000001",
    };
  }

  const supabase = await createClient();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profile) return profile as Profile;

  return createProfileIfMissing(
    user.id,
    user.email ?? "",
    user.user_metadata?.full_name as string | undefined
  );
}

/** @deprecated Use getCurrentProfile */
export async function getCurrentUser(): Promise<Profile | null> {
  return getCurrentProfile();
}

export async function getAuthContext(): Promise<AuthContext> {
  const isDemo = isDemoMode();
  if (isDemo) {
    const userId = await getDemoUserId();
    const email = await getDemoEmail();
    const profile = userId
      ? {
          id: userId,
          email: email ?? "demo@example.com",
          full_name: email?.split("@")[0] ?? "Demo Student",
          role: demoRoleForEmail(email),
          school_id: "a0000000-0000-4000-8000-000000000001",
        }
      : null;
    return { userId, profile, isLoggedIn: !!userId, email: email ?? null, isDemo: true };
  }

  const profile = await getCurrentProfile();
  return {
    userId: profile?.id ?? null,
    profile,
    isLoggedIn: !!profile,
    email: profile?.email ?? null,
    isDemo: false,
  };
}

export async function requireAuth(redirectTo?: string): Promise<AuthContext & { userId: string; profile: Profile }> {
  const auth = await getAuthContext();
  if (!auth.isLoggedIn || !auth.userId || !auth.profile) {
    const path = redirectTo ? `/auth/sign-in?redirect=${encodeURIComponent(redirectTo)}` : "/auth/sign-in";
    redirect(path);
  }
  return auth as AuthContext & { userId: string; profile: Profile };
}

export async function requireAdmin(): Promise<AuthContext & { userId: string; profile: Profile }> {
  const auth = await requireAuth("/admin");
  if (!canAccessAdmin(auth.profile)) redirect("/dashboard?error=admin_required");
  return auth;
}

export async function requireManager(): Promise<AuthContext & { userId: string; profile: Profile }> {
  const auth = await requireAuth("/manage");
  if (!(await hasManagementAccess(auth.profile))) redirect("/dashboard?error=manager_required");
  return auth;
}

export async function hasManagementAccess(profile: Profile | null): Promise<boolean> {
  if (!profile) return false;
  if (canAccessManage(profile)) return true;
  if (profile.role !== "student") return false;
  if (isDemoMode()) return false;
  const supabase = await createClient();
  if (!supabase) return false;
  const { data } = await supabase
    .from("club_memberships")
    .select("id")
    .eq("user_id", profile.id)
    .eq("status", "active")
    .in("role", ["officer", "president"])
    .limit(1);
  return !!data?.length;
}

export async function requireAnalyticsAccess(): Promise<AuthContext & { userId: string; profile: Profile }> {
  const auth = await requireAuth("/manage/analytics");
  if (!canAccessManageAnalytics(auth.profile)) redirect("/manage?error=admin_required");
  return auth;
}

export async function requireApprover(): Promise<AuthContext & { userId: string; profile: Profile }> {
  const auth = await requireAuth("/manage/approvals");
  if (!canApproveContent(auth.profile)) redirect("/manage?error=approver_required");
  return auth;
}

export async function requireClubManager(
  club: Club,
  redirectTo = "/manage/clubs"
): Promise<AuthContext & { userId: string; profile: Profile; membership: ClubMembership | null }> {
  const auth = await requireManager();
  const supabase = await createClient();
  let membership: ClubMembership | null = null;
  if (supabase) {
    const { data } = await supabase
      .from("club_memberships")
      .select("*")
      .eq("club_id", club.id)
      .eq("user_id", auth.userId)
      .eq("status", "active")
      .maybeSingle();
    membership = data as ClubMembership | null;
  }
  if (!canManageClub(auth.profile, club, membership)) {
    redirect(`${redirectTo}?error=club_permission_required`);
  }
  return { ...auth, membership };
}
