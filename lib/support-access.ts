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
    if (error.code !== "42P01") console.error("[getActivePlatformSupportSession]", error.message);
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
