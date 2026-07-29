import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/types/database";

export interface PlatformSupportSession {
  id: string;
  actor_user_id: string;
  school_id: string;
  reason: string;
  started_at: string;
  expires_at: string;
  ended_at: string | null;
}

export interface PlatformSupportAvailability {
  available: boolean;
  error?: string;
}

export function isPlatformSupportSchemaMissing(
  error: { code?: string | null; message?: string | null } | null | undefined
): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42P01"
    || error.code === "PGRST205"
    || message.includes("platform_support_sessions")
      && (
        message.includes("does not exist")
        || message.includes("schema cache")
        || message.includes("could not find")
      )
  );
}

export async function getPlatformSupportAvailability(): Promise<PlatformSupportAvailability> {
  const admin = createAdminClient();
  if (!admin) {
    return {
      available: false,
      error: "Server-side database access is not configured.",
    };
  }
  const { error } = await admin
    .from("platform_support_sessions")
    .select("id")
    .limit(1);
  if (!error) return { available: true };
  if (!isPlatformSupportSchemaMissing(error)) {
    console.error("[getPlatformSupportAvailability]", error.message);
  }
  return {
    available: false,
    error: isPlatformSupportSchemaMissing(error)
      ? "The privacy and support database update has not been applied yet."
      : "The support service could not be reached.",
  };
}

export async function getActivePlatformSupportSession(
  actor: Profile,
  schoolId: string
): Promise<PlatformSupportSession | null> {
  if (actor.role !== "super_admin") return null;
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("platform_support_sessions")
    .select("*")
    .eq("actor_user_id", actor.id)
    .eq("school_id", schoolId)
    .is("ended_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (!isPlatformSupportSchemaMissing(error)) {
      console.error("[getActivePlatformSupportSession]", error.message);
    }
    return null;
  }
  return data as PlatformSupportSession | null;
}

export async function recordPlatformSupportAccess(input: {
  actor: Profile;
  schoolId: string;
  action: "view" | "download";
  resourceType: string;
  resourceId?: string | null;
}): Promise<boolean> {
  const session = await getActivePlatformSupportSession(input.actor, input.schoolId);
  if (!session) return false;
  const admin = createAdminClient();
  if (!admin) return false;
  const { error } = await admin.from("platform_support_access_log").insert({
    session_id: session.id,
    actor_user_id: input.actor.id,
    school_id: input.schoolId,
    action: input.action,
    resource_type: input.resourceType.slice(0, 80),
    resource_id: input.resourceId ?? null,
  });
  if (error) {
    console.error("[recordPlatformSupportAccess]", error.message);
    return false;
  }
  return true;
}
