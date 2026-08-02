import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDemoMode } from "@/lib/supabase/mode";
import { getCurrentProfile } from "@/lib/auth";
import {
  demoClubs,
  demoEvents,
  demoOpportunities,
  demoAnnouncements,
  demoAssignments,
  demoMemberResources,
  demoWorkshops,
  attachClubToItems,
  demoState,
} from "@/lib/data/demo-data";
import type {
  Club,
  ClubAnnouncement,
  ClubAssignment,
  ClubAssignmentAttachment,
  ClubAssignmentStudentCopy,
  ClubAssignmentSubmission,
  ClubAssignmentSubmissionStatusEntry,
  ClubEventAttendanceEntry,
  ClubSubmissionAttachment,
  ClubMemberDirectoryEntry,
  ClubMembership,
  ClubResource,
  Event,
  Opportunity,
  Profile,
  Workshop,
  AnalyticsSummary,
  StudentDashboard,
  PendingApprovalItem,
  School,
  AdminUser,
  AdminUserPage,
  AdminStatistics,
  FeedbackItem,
  ApprovalContentType,
} from "@/types/database";
import { canAccessSchoolAdmin, isAdminRole } from "@/lib/permissions";
import { shouldServePublicDemoContent } from "@/lib/public-content";
import { CLUB_FILTER_GROUPS } from "@/lib/utils";
import {
  DEFAULT_SCHOOL_ID,
  getCurrentSchool,
  getSchoolByIdForViewer,
} from "@/lib/schools";
import type { ManagementDashboardAttention } from "@/lib/dashboard-priorities";

export { isDemoMode } from "@/lib/supabase/mode";

export async function getCurrentUser(): Promise<Profile | null> {
  return getCurrentProfile();
}

export async function getSchool(): Promise<School | null> {
  return getCurrentSchool();
}

async function shouldUseDemoContent(viewer?: Profile | null): Promise<boolean> {
  if (isDemoMode()) return true;
  const profile = viewer === undefined ? await getCurrentProfile() : viewer;
  return shouldServePublicDemoContent(profile, false);
}

async function resolveSchoolId(explicitSchoolId?: string | null, profile?: Profile | null): Promise<string | null> {
  const viewer = profile === undefined ? await getCurrentProfile() : profile;
  if (explicitSchoolId) {
    const school = await getSchoolByIdForViewer(explicitSchoolId, viewer);
    return school?.id ?? null;
  }
  const school = await getCurrentSchool(viewer);
  return school?.id ?? DEFAULT_SCHOOL_ID;
}

async function attachMemberCounts(clubs: Club[]): Promise<Club[]> {
  if (isDemoMode() || clubs.length === 0) return clubs;
  const supabase = await createClient();
  if (!supabase) return clubs;
  const ids = clubs.map((c) => c.id);
  const { data, error } = await supabase.rpc("get_visible_club_member_counts", {
    club_uuids: ids,
  });
  if (error) {
    console.error("[attachMemberCounts]", error.message);
    return clubs;
  }
  const counts: Record<string, number> = {};
  (data ?? []).forEach((row: { club_id: string; member_count: number | string }) => {
    counts[row.club_id] = Number(row.member_count) || 0;
  });
  return clubs.map((c) => ({ ...c, member_count: counts[c.id] ?? 0 }));
}

export async function getClubs(filters?: {
  category?: string;
  featured?: boolean;
  search?: string;
  filterGroup?: string;
  schoolId?: string | null;
  viewer?: Profile | null;
}): Promise<Club[]> {
  if (await shouldUseDemoContent(filters?.viewer)) {
    let clubs = [...demoClubs];
    if (filters?.featured) clubs = clubs.filter((c) => c.is_featured);
    if (filters?.category) clubs = clubs.filter((c) => c.category === filters.category);
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      clubs = clubs.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.short_description?.toLowerCase().includes(q) ||
          c.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (filters?.filterGroup) {
      const cats: readonly string[] = CLUB_FILTER_GROUPS.find(
        (item) => item.label === filters.filterGroup
      )?.categories ?? [];
      clubs = clubs.filter((c) => c.category && cats.includes(c.category));
    }
    return clubs.filter(
      (c) =>
        c.is_active &&
        c.is_listed &&
        c.visibility === "public" &&
        ["interest_open", "active"].includes(c.status)
    );
  }

  const supabase = await createClient();
  if (!supabase) return [];
  const schoolId = await resolveSchoolId(filters?.schoolId, filters?.viewer);
  if (filters?.schoolId && !schoolId) return [];

  let query = supabase
    .from("clubs")
    .select("*")
    .eq("is_active", true)
    .eq("is_listed", true)
    .eq("visibility", "public")
    .in("status", ["interest_open", "active"]);
  if (schoolId) query = query.eq("school_id", schoolId);
  if (filters?.featured) query = query.eq("is_featured", true);
  if (filters?.category) query = query.eq("category", filters.category);
  if (filters?.filterGroup) {
    const group = CLUB_FILTER_GROUPS.find((item) => item.label === filters.filterGroup);
    if (group) query = query.in("category", [...group.categories]);
  }
  if (filters?.search) {
    const q = `%${filters.search}%`;
    query = query.or(`name.ilike.${q},short_description.ilike.${q},category.ilike.${q}`);
  }

  const { data, error } = await query.order("name");
  if (error) {
    console.error("[getClubs]", error.message);
    return [];
  }
  return attachMemberCounts((data as Club[]) || []);
}

export async function getFeaturedClubs(schoolId?: string | null): Promise<Club[]> {
  return getClubs({ featured: true, schoolId });
}

export async function getClubBySlug(slug: string, schoolId?: string | null): Promise<Club | null> {
  if (await shouldUseDemoContent()) {
    return demoClubs.find((c) => c.slug === slug) ?? null;
  }
  const supabase = await createClient();
  if (!supabase) return null;
  const resolvedSchoolId = await resolveSchoolId(schoolId);
  if (schoolId && !resolvedSchoolId) return null;
  let query = supabase.from("clubs").select("*").eq("slug", slug);
  if (resolvedSchoolId) query = query.eq("school_id", resolvedSchoolId);
  const { data, error } = await query.single();
  if (error) {
    console.error("[getClubBySlug]", error.message);
    return null;
  }
  return data as Club | null;
}

export async function getManagedClubBySlug(slug: string): Promise<Club | null> {
  if (isDemoMode()) {
    return demoClubs.find((c) => c.slug === slug) ?? null;
  }
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("clubs").select("*").eq("slug", slug).maybeSingle();
  if (error) {
    console.error("[getManagedClubBySlug]", error.message);
    return null;
  }
  return data as Club | null;
}

export async function getClubMemberCount(clubId: string): Promise<number> {
  if (await shouldUseDemoContent()) {
    const club = demoClubs.find((c) => c.id === clubId);
    return club?.member_count ?? 0;
  }
  const supabase = await createClient();
  if (!supabase) return 0;
  const { data, error } = await supabase.rpc("get_visible_club_member_counts", {
    club_uuids: [clubId],
  });
  if (error) {
    console.error("[getClubMemberCount]", error.message);
    return 0;
  }
  const row = (data as Array<{ club_id: string; member_count: number | string }> | null)?.[0];
  return row ? Number(row.member_count) || 0 : 0;
}

export async function getUserClubMembership(
  userId: string | null,
  clubId: string
): Promise<ClubMembership | null> {
  if (!userId) return null;
  if (isDemoMode()) {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const raw = cookieStore.get("stormhub_demo_memberships")?.value;
    let joinedSlugs = demoState.memberships;
    if (raw) {
      try {
        joinedSlugs = new Set(JSON.parse(raw) as string[]);
      } catch {
        joinedSlugs = new Set();
      }
    }
    const club = demoClubs.find((c) => c.id === clubId);
    if (club && joinedSlugs.has(club.slug)) {
      return {
        id: `demo-membership-${clubId}`,
        club_id: clubId,
        user_id: userId,
        status: "active",
        role: "member",
        joined_at: new Date().toISOString(),
      };
    }
    return null;
  }
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("club_memberships")
    .select("*")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return data as ClubMembership | null;
}

/**
 * Loads the viewer's active membership state for a rendered club list in one
 * database request. Directory pages used to perform an auth, club, and
 * membership lookup for every card, which made tab switches progressively
 * slower as a school's catalog grew.
 */
export async function getUserClubMembershipIds(
  userId: string | null,
  clubIds?: string[]
): Promise<Set<string>> {
  if (!userId || clubIds?.length === 0) return new Set();
  if (isDemoMode()) {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const raw = cookieStore.get("stormhub_demo_memberships")?.value;
    let joinedSlugs = demoState.memberships;
    if (raw) {
      try {
        joinedSlugs = new Set(JSON.parse(raw) as string[]);
      } catch {
        joinedSlugs = new Set();
      }
    }
    return new Set(
      demoClubs
        .filter((club) => (!clubIds || clubIds.includes(club.id)) && joinedSlugs.has(club.slug))
        .map((club) => club.id)
    );
  }

  const supabase = await createClient();
  if (!supabase) return new Set();
  let query = supabase
    .from("club_memberships")
    .select("club_id")
    .eq("user_id", userId)
    .eq("status", "active");
  if (clubIds) query = query.in("club_id", clubIds);
  const { data, error } = await query;
  if (error) {
    console.error("[getUserClubMembershipIds]", error.message);
    return new Set();
  }
  return new Set((data ?? []).map((membership) => membership.club_id as string));
}

export async function getUserMembershipBySlug(
  userId: string | null,
  slug: string
): Promise<ClubMembership | null> {
  const club = await getClubBySlug(slug);
  if (!club) return null;
  return getUserClubMembership(userId, club.id);
}

export async function getClubAnnouncements(
  clubId: string,
  visibility?: "public" | "members"
): Promise<ClubAnnouncement[]> {
  if (await shouldUseDemoContent()) {
    let announcements = demoAnnouncements.filter((a) => a.club_id === clubId && a.status === "approved");
    if (visibility) announcements = announcements.filter((a) => a.visibility === visibility || a.visibility === "public");
    return announcements;
  }
  const supabase = await createClient();
  if (!supabase) return [];
  let query = supabase
    .from("club_announcements")
    .select("*")
    .eq("club_id", clubId)
    .eq("status", "approved");
  if (visibility === "public") {
    query = query.eq("visibility", "public");
  }
  // members visibility: RLS ensures only members see member-only posts
  const { data } = await query
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  return (data as ClubAnnouncement[]) || [];
}

export async function getClubManagedContent(
  clubId: string,
  type: Exclude<ApprovalContentType, "opportunity" | "workshop">
): Promise<Array<ClubAnnouncement | ClubResource | Event>> {
  if (isDemoMode()) {
    if (type === "announcement") return demoAnnouncements.filter((item) => item.club_id === clubId);
    if (type === "resource") return Object.values(demoMemberResources).flat().filter((item) => item.club_id === clubId);
    return demoEvents.filter((item) => item.club_id === clubId);
  }
  const supabase = await createClient();
  if (!supabase) return [];
  const table =
    type === "announcement"
      ? "club_announcements"
      : type === "resource"
        ? "club_resources"
        : "events";
  const orderColumn = type === "event" ? "starts_at" : type === "announcement" ? "published_at" : "created_at";
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("club_id", clubId)
    .neq("status", "archived")
    .order(orderColumn, { ascending: type === "event", nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[getClubManagedContent]", error.message);
    return [];
  }
  return (data as Array<ClubAnnouncement | ClubResource | Event>) ?? [];
}

function normalizeAssignment(row: ClubAssignment): ClubAssignment {
  return {
    ...row,
    points_possible: Number(row.points_possible),
    submission_mode: row.submission_mode ?? "submission",
    submission: row.submission
      ? {
          ...row.submission,
          grade_points:
            row.submission.grade_points === null || row.submission.grade_points === undefined
              ? null
              : Number(row.submission.grade_points),
        }
      : row.submission,
  };
}

export async function getClubAssignments(
  clubId: string,
  options: { userId?: string | null; includeArchived?: boolean } = {}
): Promise<ClubAssignment[]> {
  if (isDemoMode()) {
    return demoAssignments
      .filter((assignment) => assignment.club_id === clubId)
      .filter((assignment) => options.includeArchived || assignment.status !== "archived")
      .map(normalizeAssignment);
  }

  const supabase = await createClient();
  if (!supabase) return [];

  let query = supabase
    .from("club_assignments")
    .select("*")
    .eq("club_id", clubId);
  if (!options.includeArchived) query = query.neq("status", "archived");

  const { data, error } = await query
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[getClubAssignments]", error.message);
    return [];
  }

  const assignments = ((data as ClubAssignment[]) ?? []).map(normalizeAssignment);
  if (!options.userId || assignments.length === 0) return assignments;

  const { data: submissions, error: submissionError } = await supabase
    .from("club_assignment_submissions")
    .select("*")
    .eq("student_id", options.userId)
    .in("assignment_id", assignments.map((assignment) => assignment.id));
  if (submissionError) {
    console.error("[getClubAssignments submissions]", submissionError.message);
    return assignments;
  }

  const submissionMap = new Map(
    ((submissions as ClubAssignmentSubmission[]) ?? []).map((submission) => [
      submission.assignment_id,
      submission,
    ])
  );
  return assignments.map((assignment) =>
    normalizeAssignment({ ...assignment, submission: submissionMap.get(assignment.id) ?? null })
  );
}

export async function getClubAssignment(
  assignmentId: string,
  userId?: string | null
): Promise<ClubAssignment | null> {
  if (isDemoMode()) {
    const assignment = demoAssignments.find((item) => item.id === assignmentId);
    return assignment
      ? normalizeAssignment({
          ...assignment,
          attachments: assignment.attachments ?? [],
          student_copies: assignment.student_copies ?? [],
          submission_attachments: assignment.submission_attachments ?? [],
        })
      : null;
  }

  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("club_assignments")
    .select("*")
    .eq("id", assignmentId)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("[getClubAssignment]", error.message);
    return null;
  }

  const assignment = normalizeAssignment(data as ClubAssignment);
  const { data: attachmentRows, error: attachmentError } = await supabase
    .from("club_assignment_attachments")
    .select("*")
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: true });
  if (attachmentError) {
    console.error("[getClubAssignment attachments]", attachmentError.message);
  }
  const attachments = (attachmentRows as ClubAssignmentAttachment[] | null) ?? [];
  if (!userId) return { ...assignment, attachments };

  const [{ data: submission }, { data: submissionAttachmentRows }, { data: studentCopyRows }] =
    await Promise.all([
      supabase
        .from("club_assignment_submissions")
        .select("*")
        .eq("assignment_id", assignmentId)
        .eq("student_id", userId)
        .maybeSingle(),
      supabase
        .from("club_submission_attachments")
        .select("*")
        .eq("assignment_id", assignmentId)
        .eq("student_id", userId)
        .order("created_at", { ascending: true }),
      supabase
        .from("club_assignment_student_copies")
        .select("*")
        .eq("assignment_id", assignmentId)
        .eq("student_id", userId),
    ]);
  const submissionAttachments =
    (submissionAttachmentRows as ClubSubmissionAttachment[] | null) ?? [];
  return normalizeAssignment({
    ...assignment,
    attachments,
    student_copies: (studentCopyRows as ClubAssignmentStudentCopy[] | null) ?? [],
    submission_attachments: submissionAttachments,
    submission: submission
      ? {
          ...(submission as ClubAssignmentSubmission),
          attachments: submissionAttachments,
        }
      : null,
  });
}

export async function getClubAssignmentSubmissions(
  assignmentId: string
): Promise<ClubAssignmentSubmission[]> {
  if (isDemoMode()) return [];
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("club_assignment_submissions")
    .select("*, student:profiles!club_assignment_submissions_student_id_fkey(id,full_name,avatar_url)")
    .eq("assignment_id", assignmentId)
    .order("submitted_at", { ascending: false, nullsFirst: false });
  if (error) {
    console.error("[getClubAssignmentSubmissions]", error.message);
    return [];
  }
  const submissions = (data as ClubAssignmentSubmission[]) ?? [];
  if (submissions.length === 0) return [];
  const [
    { data: attachmentRows, error: attachmentError },
    { data: studentCopyRows, error: studentCopyError },
  ] = await Promise.all([
    supabase
      .from("club_submission_attachments")
      .select("*")
      .eq("assignment_id", assignmentId)
      .order("created_at", { ascending: true }),
    supabase
      .from("club_assignment_student_copies")
      .select("*")
      .eq("assignment_id", assignmentId),
  ]);
  if (attachmentError) {
    console.error("[getClubAssignmentSubmissions attachments]", attachmentError.message);
  }
  if (studentCopyError) {
    console.error("[getClubAssignmentSubmissions copies]", studentCopyError.message);
  }
  const attachmentsBySubmission = new Map<string, ClubSubmissionAttachment[]>();
  for (const attachment of (attachmentRows as ClubSubmissionAttachment[] | null) ?? []) {
    if (!attachment.submission_id) continue;
    const current = attachmentsBySubmission.get(attachment.submission_id) ?? [];
    current.push(attachment);
    attachmentsBySubmission.set(attachment.submission_id, current);
  }
  return submissions.map((submission) => ({
    ...submission,
    attachments: attachmentsBySubmission.get(submission.id) ?? [],
    student_copies: ((studentCopyRows as ClubAssignmentStudentCopy[] | null) ?? [])
      .filter((copy) => copy.student_id === submission.student_id),
    grade_points:
      submission.grade_points === null || submission.grade_points === undefined
        ? null
        : Number(submission.grade_points),
  }));
}

export async function getClubAssignmentSubmissionStatuses(
  assignmentId: string
): Promise<ClubAssignmentSubmissionStatusEntry[]> {
  if (isDemoMode()) return [];
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_club_assignment_submission_statuses", {
    assignment_uuid: assignmentId,
  });
  if (error) {
    console.error("[getClubAssignmentSubmissionStatuses]", error.message);
    return [];
  }
  return (data as ClubAssignmentSubmissionStatusEntry[]) ?? [];
}

export async function getClubEventAttendance(
  eventId: string
): Promise<ClubEventAttendanceEntry[]> {
  if (isDemoMode()) return [];
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_club_event_attendance", {
    event_uuid: eventId,
  });
  if (error) {
    console.error("[getClubEventAttendance]", error.message);
    return [];
  }
  return (data as ClubEventAttendanceEntry[]) ?? [];
}

export async function getClubMemberDirectory(clubId: string): Promise<ClubMemberDirectoryEntry[]> {
  if (isDemoMode()) {
    return [
      {
        user_id: "demo-teacher",
        full_name: "Club Sponsor",
        avatar_url: null,
        membership_role: "sponsor",
        joined_at: new Date().toISOString(),
      },
      {
        user_id: "demo-student",
        full_name: "Demo Student",
        avatar_url: null,
        membership_role: "member",
        joined_at: new Date().toISOString(),
      },
    ];
  }
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_club_member_directory", {
    club_uuid: clubId,
  });
  if (error) {
    console.error("[getClubMemberDirectory]", error.message);
    return [];
  }
  return (data as ClubMemberDirectoryEntry[]) ?? [];
}

export async function getRecentAnnouncements(
  limit = 5,
  schoolId?: string | null
): Promise<(ClubAnnouncement & { club?: Club })[]> {
  if (isDemoMode()) {
    return demoAnnouncements
      .filter((announcement) => announcement.status === "approved")
      .slice(0, limit)
      .map((announcement) => ({
        ...announcement,
        club: demoClubs.find((club) => club.id === announcement.club_id),
      }));
  }
  const supabase = await createClient();
  if (!supabase) return [];
  const resolvedSchoolId = await resolveSchoolId(schoolId);
  const { data, error } = await supabase
    .from("club_announcements")
    .select("*, club:clubs!inner(*)")
    .eq("status", "approved")
    .eq("club.school_id", resolvedSchoolId ?? DEFAULT_SCHOOL_ID)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[getRecentAnnouncements]", error.message);
    return [];
  }
  return (data as (ClubAnnouncement & { club?: Club })[]) ?? [];
}

export async function getClubResources(clubSlug: string): Promise<ClubResource[]> {
  if (await shouldUseDemoContent()) {
    return demoMemberResources[clubSlug] || [];
  }
  const club = await getClubBySlug(clubSlug);
  if (!club) return [];
  return getClubResourcesByClubId(club.id);
}

export async function getClubResourcesByClubId(clubId: string): Promise<ClubResource[]> {
  if (await shouldUseDemoContent()) {
    return Object.values(demoMemberResources).flat().filter((resource) => resource.club_id === clubId);
  }
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("club_resources")
    .select("*")
    .eq("club_id", clubId)
    .eq("status", "approved")
    .order("title");
  return (data as ClubResource[]) || [];
}

export async function getClubEvents(clubId: string, includeMembersOnly = false): Promise<Event[]> {
  if (await shouldUseDemoContent()) {
    let events = demoEvents.filter((e) => e.club_id === clubId && e.status === "approved");
    if (!includeMembersOnly) events = events.filter((e) => e.visibility === "public");
    return events;
  }
  const supabase = await createClient();
  if (!supabase) return [];
  let query = supabase.from("events").select("*").eq("club_id", clubId).eq("status", "approved");
  if (!includeMembersOnly) query = query.eq("visibility", "public");
  const { data } = await query.order("starts_at");
  return (data as Event[]) || [];
}

export async function getOpportunities(filters?: {
  category?: string;
  search?: string;
  closingSoon?: boolean;
  schoolId?: string | null;
  viewer?: Profile | null;
}): Promise<Opportunity[]> {
  const profile = filters?.viewer === undefined ? await getCurrentProfile() : filters.viewer;
  const adminView = isAdminRole(profile?.role);
  if (shouldServePublicDemoContent(profile, isDemoMode())) {
    let opps = demoOpportunities.filter(
      (o) =>
        (adminView || (o.status === "approved" && o.visibility === "public")) &&
        o.category !== "Volunteering"
    );
    if (filters?.category) opps = opps.filter((o) => o.category === filters.category);
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      opps = opps.filter(
        (o) =>
          o.title.toLowerCase().includes(q) ||
          o.summary?.toLowerCase().includes(q) ||
          o.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (filters?.closingSoon) {
      const week = 7 * 24 * 60 * 60 * 1000;
      opps = opps.filter((o) => o.deadline && new Date(o.deadline).getTime() - Date.now() < week);
    }
    return opps;
  }
  const supabase = await createClient();
  if (!supabase) return [];
  const schoolId = await resolveSchoolId(filters?.schoolId, profile);
  let query = supabase
    .from("opportunities")
    .select("*")
    .neq("category", "Volunteering");
  if (schoolId) query = query.eq("school_id", schoolId);
  if (!adminView) {
    query = query.eq("status", "approved").eq("visibility", "public");
  }
  if (filters?.category) query = query.eq("category", filters.category);
  if (filters?.search) {
    const q = `%${filters.search}%`;
    query = query.or(`title.ilike.${q},summary.ilike.${q},description.ilike.${q},category.ilike.${q}`);
  }
  if (filters?.closingSoon) {
    const soon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    query = query.not("deadline", "is", null).gte("deadline", new Date().toISOString()).lte("deadline", soon);
  }
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) {
    console.error("[getOpportunities]", error.message);
    return [];
  }
  return (data as Opportunity[]) || [];
}

export async function getOpportunityCategories(
  schoolId?: string | null,
  viewer?: Profile | null
): Promise<string[]> {
  if (await shouldUseDemoContent(viewer)) {
    return [...new Set(demoOpportunities.map((opportunity) => opportunity.category).filter(Boolean) as string[])].sort();
  }
  const supabase = await createClient();
  if (!supabase) return [];
  const resolvedSchoolId = await resolveSchoolId(schoolId, viewer);
  if (schoolId && !resolvedSchoolId) return [];
  const adminView = isAdminRole(viewer?.role);
  let query = supabase
    .from("opportunities")
    .select("category")
    .neq("category", "Volunteering");
  if (resolvedSchoolId) query = query.eq("school_id", resolvedSchoolId);
  if (!adminView) query = query.eq("status", "approved").eq("visibility", "public");
  const { data, error } = await query;
  if (error) {
    console.error("[getOpportunityCategories]", error.message);
    return [];
  }
  return [...new Set((data ?? []).map((opportunity) => opportunity.category).filter(Boolean) as string[])].sort();
}

export async function getOpportunityBySlug(slug: string): Promise<Opportunity | null> {
  const profile = await getCurrentProfile();
  const adminView = isAdminRole(profile?.role);
  if (shouldServePublicDemoContent(profile, isDemoMode())) {
    const opp = demoOpportunities.find((o) => o.slug === slug);
    if (
      !opp ||
      opp.category === "Volunteering" ||
      (!adminView && (opp.status !== "approved" || opp.visibility !== "public"))
    ) return null;
    return opp;
  }
  const supabase = await createClient();
  if (!supabase) return null;
  const school = await getCurrentSchool(profile);
  let query = supabase
    .from("opportunities")
    .select("*")
    .eq("slug", slug)
    .neq("category", "Volunteering");
  if (school?.id) query = query.eq("school_id", school.id);
  if (!adminView) {
    query = query.eq("status", "approved").eq("visibility", "public");
  }
  const { data, error } = await query.single();
  if (error) {
    console.error("[getOpportunityBySlug]", error.message);
    return null;
  }
  return data as Opportunity | null;
}

export async function getEvents(filters?: {
  eventType?: string;
  upcoming?: boolean;
  schoolId?: string | null;
  viewer?: Profile | null;
}): Promise<Event[]> {
  if (await shouldUseDemoContent(filters?.viewer)) {
    let events = attachClubToItems(
      demoEvents.filter(
        (e) => e.status === "approved" && e.visibility === "public" && String(e.event_type) !== "volunteer"
      ),
      demoClubs
    );
    if (filters?.eventType) events = events.filter((e) => e.event_type === filters.eventType);
    if (filters?.upcoming !== false) {
      events = events.filter((e) => new Date(e.starts_at) >= new Date());
    }
    return events.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }
  const supabase = await createClient();
  if (!supabase) return [];
  const schoolId = await resolveSchoolId(filters?.schoolId, filters?.viewer);
  let query = supabase
    .from("events")
    .select("*, club:clubs(*)")
    .eq("status", "approved")
    .eq("visibility", "public")
    .neq("event_type", "volunteer");
  if (schoolId) query = query.eq("school_id", schoolId);
  if (filters?.eventType) query = query.eq("event_type", filters.eventType);
  if (filters?.upcoming !== false) query = query.gte("starts_at", new Date().toISOString());
  const { data, error } = await query.order("starts_at");
  if (error) {
    console.error("[getEvents]", error.message);
    return [];
  }
  return (data as Event[]) || [];
}

export async function getCalendarEvents(
  userId: string | null,
  schoolId?: string | null,
  viewer?: Profile | null
): Promise<Event[]> {
  if (await shouldUseDemoContent(viewer)) {
    const joinedClubIds = new Set(
      demoClubs
        .filter((club) => demoState.memberships.has(club.slug))
        .map((club) => club.id)
    );
    return attachClubToItems(
      demoEvents.filter(
        (event) =>
          event.status === "approved" &&
          String(event.event_type) !== "volunteer" &&
          (event.visibility === "public" ||
            Boolean(event.club_id && userId && joinedClubIds.has(event.club_id))),
      ),
      demoClubs
    ).sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    );
  }

  const supabase = await createClient();
  if (!supabase) return [];
  const resolvedSchoolId = await resolveSchoolId(schoolId, viewer);

  const rangeStart = new Date();
  rangeStart.setFullYear(rangeStart.getFullYear() - 1);
  const rangeEnd = new Date();
  rangeEnd.setFullYear(rangeEnd.getFullYear() + 2);

  // RLS adds approved member-only events for clubs the signed-in user belongs
  // to while anonymous visitors receive only public calendar entries.
  const { data, error } = await supabase
    .from("events")
    .select("*, club:clubs(*)")
    .eq("status", "approved")
    .neq("event_type", "volunteer")
    .eq("school_id", resolvedSchoolId ?? DEFAULT_SCHOOL_ID)
    .gte("starts_at", rangeStart.toISOString())
    .lte("starts_at", rangeEnd.toISOString())
    .order("starts_at");

  if (error) {
    console.error("[getCalendarEvents]", error.message);
    return [];
  }
  return (data as Event[]) || [];
}

export async function getEventById(id: string): Promise<Event | null> {
  if (await shouldUseDemoContent()) {
    const event = demoEvents.find((e) => e.id === id);
    if (!event || String(event.event_type) === "volunteer") return null;
    const club = event.club_id ? demoClubs.find((c) => c.id === event.club_id) : null;
    return { ...event, club };
  }
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("events")
    .select("*, club:clubs(*)")
    .eq("id", id)
    .eq("status", "approved")
    .neq("event_type", "volunteer")
    .maybeSingle();
  if (error) {
    console.error("[getEventById]", error.message);
    return null;
  }
  return data as Event | null;
}

export async function getWorkshops(): Promise<Workshop[]> {
  if (isDemoMode()) return demoWorkshops.filter((w) => w.status === "approved");
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("workshops").select("*").eq("status", "approved").order("starts_at");
  if (error) {
    console.error("[getWorkshops]", error.message);
    return [];
  }
  return (data as Workshop[]) || [];
}

export async function getStats() {
  const clubs = await getClubs();
  const events = await getEvents();
  const opportunities = await getOpportunities();
  const totalMembers = clubs.reduce((sum, c) => sum + (c.member_count ?? 0), 0);
  return {
    clubsCount: clubs.length,
    eventsCount: events.length,
    opportunitiesCount: opportunities.length,
    studentsJoined: totalMembers,
  };
}

export async function getAdminAnalytics(): Promise<AnalyticsSummary> {
  if (isDemoMode()) {
    const clubs = await getClubs();
    const events = await getEvents();
    const opportunities = await getOpportunities();
    const sorted = [...clubs].sort((a, b) => (b.member_count ?? 0) - (a.member_count ?? 0));
    return {
      totalClubs: clubs.length,
      activeClubs: clubs.filter((c) => c.status === "active").length,
      totalStudents: clubs.reduce((sum, c) => sum + (c.member_count ?? 0), 0),
      totalMemberships: clubs.reduce((sum, c) => sum + (c.member_count ?? 0), 0),
      upcomingEvents: events.length,
      totalOpportunities: opportunities.length,
      totalRsvps: demoState.rsvps.size,
      totalBookmarks: demoState.bookmarks.size,
      mostJoinedClubs: sorted.slice(0, 5).map((c) => ({ name: c.name, slug: c.slug, count: c.member_count ?? 0 })),
      recentActivity: [
        { type: "membership", description: "New club join", created_at: new Date().toISOString() },
        { type: "rsvp", description: "Event RSVP", created_at: new Date().toISOString() },
      ],
    };
  }

  const supabase = await createClient();
  if (!supabase) {
    const clubs = await getClubs();
    const events = await getEvents();
    const opportunities = await getOpportunities();
    const sorted = [...clubs].sort((a, b) => (b.member_count ?? 0) - (a.member_count ?? 0));
    return {
      totalClubs: clubs.length,
      activeClubs: clubs.filter((c) => c.status === "active").length,
      totalStudents: 0,
      totalMemberships: 0,
      upcomingEvents: events.length,
      totalOpportunities: opportunities.length,
      totalRsvps: 0,
      totalBookmarks: 0,
      mostJoinedClubs: sorted.slice(0, 5).map((c) => ({ name: c.name, slug: c.slug, count: c.member_count ?? 0 })),
      recentActivity: [],
    };
  }

  const currentProfile = await getCurrentProfile();
  const schoolScopeId = currentProfile?.role === "super_admin" ? null : currentProfile?.school_id;
  let totalClubsQuery = supabase.from("clubs").select("*", { count: "exact", head: true });
  let activeClubsQuery = supabase.from("clubs").select("*", { count: "exact", head: true }).eq("status", "active");
  let upcomingEventsQuery = supabase.from("events").select("*", { count: "exact", head: true }).eq("status", "approved").gte("starts_at", new Date().toISOString());
  let opportunitiesQuery = supabase.from("opportunities").select("*", { count: "exact", head: true }).eq("status", "approved");
  let recentActivityQuery = supabase.from("analytics_events").select("event_type, metadata, created_at").order("created_at", { ascending: false }).limit(10);
  if (schoolScopeId) {
    totalClubsQuery = totalClubsQuery.eq("school_id", schoolScopeId);
    activeClubsQuery = activeClubsQuery.eq("school_id", schoolScopeId);
    upcomingEventsQuery = upcomingEventsQuery.eq("school_id", schoolScopeId);
    opportunitiesQuery = opportunitiesQuery.eq("school_id", schoolScopeId);
    recentActivityQuery = recentActivityQuery.eq("school_id", schoolScopeId);
  }

  const [
    { count: totalClubs },
    { count: activeClubs },
    { count: totalMemberships },
    { count: upcomingEvents },
    { count: totalOpportunities },
    { count: totalRsvps },
    { count: totalBookmarks },
    { data: topClubs },
    { data: recentActivity },
  ] = await Promise.all([
    totalClubsQuery,
    activeClubsQuery,
    supabase.from("club_memberships").select("*", { count: "exact", head: true }).eq("status", "active").neq("role", "sponsor"),
    upcomingEventsQuery,
    opportunitiesQuery,
    supabase.from("event_rsvps").select("*", { count: "exact", head: true }),
    supabase.from("bookmarks").select("*", { count: "exact", head: true }),
    supabase.from("club_memberships").select("club_id, clubs(name, slug)").eq("status", "active").neq("role", "sponsor"),
    recentActivityQuery,
  ]);

  type MembershipClubRow = { club_id: string; clubs: { name: string; slug: string } | { name: string; slug: string }[] | null };
  const clubCounts: Record<string, { name: string; slug: string; count: number }> = {};
  ((topClubs ?? []) as MembershipClubRow[]).forEach((m) => {
    const club = Array.isArray(m.clubs) ? m.clubs[0] : m.clubs;
    if (!club) return;
    if (!clubCounts[m.club_id]) clubCounts[m.club_id] = { name: club.name, slug: club.slug, count: 0 };
    clubCounts[m.club_id].count++;
  });

  return {
    totalClubs: totalClubs ?? 0,
    activeClubs: activeClubs ?? 0,
    totalStudents: totalMemberships ?? 0,
    totalMemberships: totalMemberships ?? 0,
    upcomingEvents: upcomingEvents ?? 0,
    totalOpportunities: totalOpportunities ?? 0,
    totalRsvps: totalRsvps ?? 0,
    totalBookmarks: totalBookmarks ?? 0,
    mostJoinedClubs: Object.values(clubCounts).sort((a, b) => b.count - a.count).slice(0, 5),
    recentActivity: (recentActivity ?? []).map((a: { event_type: string; metadata: Record<string, unknown>; created_at: string }) => ({
      type: a.event_type,
      description: String(a.metadata?.description ?? a.event_type),
      created_at: a.created_at,
    })),
  };
}

function demoAdminStatistics(
  schoolId: string | null,
  districtId: string | null = null,
): AdminStatistics {
  const activeMemberships = demoClubs.reduce((sum, club) => sum + (club.member_count ?? 0), 0);
  const totalPeople = Math.max(activeMemberships + 14, 48);
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  const monthlyActivity = Array.from({ length: 6 }, (_, index) => {
    const month = new Date(Date.UTC(
      monthStart.getUTCFullYear(),
      monthStart.getUTCMonth() - (5 - index),
      1,
    )).toISOString().slice(0, 7);
    return {
      month,
      newPeople: [7, 10, 8, 14, 11, 16][index],
      newMemberships: [12, 18, 15, 24, 21, 29][index],
      engagementEvents: [28, 42, 39, 64, 58, 81][index],
    };
  });
  const clubStatusDistribution = (["active", "interest_open", "draft", "paused", "archived"] as const)
    .map((status) => ({
      status,
      count: demoClubs.filter((club) => club.status === status).length,
    }));
  const topClubs = demoClubs
    .filter((club) => ["active", "interest_open"].includes(club.status))
    .map((club) => {
      const recentEvents = demoEvents.filter((event) => event.club_id === club.id).length;
      const members = club.member_count ?? 0;
      const recentActivity = Math.max(2, Math.round(members / 3));
      return {
        id: club.id,
        name: club.name,
        slug: club.slug,
        status: club.status,
        members,
        recentEvents,
        recentActivity,
        score: members + (recentEvents * 3) + recentActivity,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  return {
    scopeSchoolId: schoolId,
    scopeDistrictId: districtId,
    totalPeople,
    activePeople: totalPeople - 2,
    engagedPeople30d: Math.min(totalPeople - 2, Math.max(activeMemberships, 32)),
    newPeople30d: monthlyActivity.at(-1)?.newPeople ?? 0,
    totalClubs: demoClubs.length,
    activeClubs: demoClubs.filter((club) => club.status === "active" && club.is_active !== false).length,
    activeMemberships,
    upcomingEvents: demoEvents.length,
    engagementEvents30d: monthlyActivity.at(-1)?.engagementEvents ?? 0,
    roleDistribution: [
      { role: "student", count: totalPeople - 10 },
      { role: "teacher", count: 7 },
      { role: "admin", count: 3 },
      { role: "district_admin", count: 1 },
      { role: "super_admin", count: 0 },
    ],
    clubStatusDistribution,
    monthlyActivity,
    topClubs,
  };
}

export async function getScopedAdminStatistics(
  profile: Profile,
  requestedSchoolId?: string | null,
  requestedDistrictId?: string | null,
): Promise<AdminStatistics | null> {
  if (!isAdminRole(profile.role)) return null;

  const schoolId = profile.role === "super_admin" || profile.role === "district_admin"
    ? requestedSchoolId ?? null
    : profile.school_id ?? null;
  const districtId = profile.role === "super_admin"
    ? requestedDistrictId ?? null
    : profile.district_id ?? null;
  if (profile.role === "admin" && !schoolId) return null;
  if (profile.role === "district_admin" && !profile.district_id) return null;

  if (isDemoMode()) {
    return demoAdminStatistics(
      schoolId,
      districtId,
    );
  }

  const supabase = await createClient();
  if (!supabase) return null;
  let result = await supabase.rpc("get_admin_statistics", {
    requested_school_id: schoolId,
    requested_district_id: districtId,
  });
  if (
    result.error
    && profile.role !== "district_admin"
    && (
      result.error.code === "PGRST202"
      || result.error.code === "42883"
      || result.error.message.includes("get_admin_statistics")
    )
  ) {
    // During a staged rollout, the app can still read the legacy one-argument
    // RPC until the district migration is applied. District access itself
    // remains unavailable until the new database function exists.
    result = await supabase.rpc("get_admin_statistics", {
      requested_school_id: schoolId,
    });
  }
  const { data, error } = result;
  if (error) {
    console.error("[getScopedAdminStatistics]", error.message);
    return null;
  }

  return data as AdminStatistics;
}

export async function getStudentDashboard(userId: string | null): Promise<StudentDashboard> {
  if (!userId) {
    return {
      memberships: [],
      upcomingEvents: [],
      upcomingAssignments: [],
      savedOpportunities: [],
      recommendedOpportunities: [],
      recentAnnouncements: [],
    };
  }

  if (isDemoMode()) {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const raw = cookieStore.get("stormhub_demo_memberships")?.value;
    let joinedSlugs: string[] = [];
    try {
      joinedSlugs = raw ? JSON.parse(raw) as string[] : [...demoState.memberships];
    } catch {
      joinedSlugs = [...demoState.memberships];
    }
    const memberships: ClubMembership[] = joinedSlugs
      .map((slug) => {
        const club = demoClubs.find((c) => c.slug === slug);
        if (!club) return null;
        return {
          id: `demo-${slug}`,
          club_id: club.id,
          user_id: userId,
          status: "active" as const,
          role: "member" as const,
          joined_at: new Date().toISOString(),
          club,
        };
      })
      .filter(Boolean) as ClubMembership[];

    const clubIds = memberships.map((m) => m.club_id);
    const rsvpsRaw = cookieStore.get("stormhub_demo_rsvps")?.value;
    let rsvpIds = new Set<string>();
    try {
      rsvpIds = rsvpsRaw ? new Set(JSON.parse(rsvpsRaw)) : demoState.rsvps;
    } catch {
      rsvpIds = demoState.rsvps;
    }
    const upcomingEvents = demoEvents
      .filter((e) => (e.club_id && clubIds.includes(e.club_id)) || rsvpIds.has(e.id))
      .filter((e) => e.status === "approved" && new Date(e.starts_at) >= new Date())
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

    const bookmarksRaw = cookieStore.get("stormhub_demo_bookmarks")?.value;
    let bookmarkIds = new Set<string>();
    try {
      bookmarkIds = bookmarksRaw ? new Set(JSON.parse(bookmarksRaw)) : demoState.bookmarks;
    } catch {
      bookmarkIds = demoState.bookmarks;
    }
    const savedOpportunities = demoOpportunities.filter((o) => bookmarkIds.has(o.id));
    const categories = memberships.map((m) => m.club?.category).filter(Boolean);
    const recommendedOpportunities = demoOpportunities
      .filter((o) => categories.includes(o.category ?? "") && !bookmarkIds.has(o.id))
      .slice(0, 4);

    const recentAnnouncements = demoAnnouncements
      .filter((a) => clubIds.includes(a.club_id))
      .map((a) => ({
        ...a,
        club: demoClubs.find((c) => c.id === a.club_id),
      }))
      .slice(0, 5);
    const upcomingAssignments = demoAssignments
      .filter((assignment) => clubIds.includes(assignment.club_id))
      .map((assignment) => ({
        ...assignment,
        club: demoClubs.find((club) => club.id === assignment.club_id),
      }))
      .slice(0, 5);

    return {
      memberships,
      upcomingEvents,
      upcomingAssignments,
      savedOpportunities,
      recommendedOpportunities,
      recentAnnouncements,
    };
  }

  const supabase = await createClient();
  if (!supabase) {
    return {
      memberships: [],
      upcomingEvents: [],
      upcomingAssignments: [],
      savedOpportunities: [],
      recommendedOpportunities: [],
      recentAnnouncements: [],
    };
  }
  const profile = await getCurrentProfile();
  const schoolId = profile?.school_id ?? DEFAULT_SCHOOL_ID;

  const { data: memberships } = await supabase
    .from("club_memberships")
    .select("*, club:clubs(*)")
    .eq("user_id", userId)
    .eq("status", "active");

  const schoolMemberships = ((memberships as ClubMembership[]) ?? []).filter((m) => m.club?.school_id === schoolId);
  const clubIds = schoolMemberships.map((m) => m.club_id);
  const categories = schoolMemberships
    .map((m) => m.club?.category)
    .filter(Boolean) as string[];

  let upcomingEvents: Event[] = [];
  if (clubIds.length > 0) {
    const { data: events } = await supabase
      .from("events")
      .select("*, club:clubs(*)")
      .in("club_id", clubIds)
      .eq("school_id", schoolId)
      .eq("status", "approved")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(10);
    upcomingEvents = (events as Event[]) ?? [];
  }

  const { data: rsvpRows } = await supabase
    .from("event_rsvps")
    .select("events(*, club:clubs(*))")
    .eq("user_id", userId)
    .in("status", ["going", "interested"]);
  const rsvpEvents = ((rsvpRows ?? []) as { events: Event | Event[] | null }[])
    .map((row) => Array.isArray(row.events) ? row.events[0] : row.events)
    .filter((event): event is Event =>
      !!event &&
      event.school_id === schoolId &&
      event.status === "approved" &&
      new Date(event.starts_at) >= new Date()
    );
  const eventMap = new Map(upcomingEvents.map((event) => [event.id, event]));
  rsvpEvents.forEach((event) => eventMap.set(event.id, event));
  upcomingEvents = [...eventMap.values()]
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .slice(0, 10);

  const { data: bookmarks } = await supabase
    .from("bookmarks")
    .select("opportunity_id, opportunities(*, club:clubs(*))")
    .eq("user_id", userId)
    .not("opportunity_id", "is", null);

  const savedOpportunities = ((bookmarks ?? []) as { opportunities: Opportunity | Opportunity[] | null }[])
    .map((b) => (Array.isArray(b.opportunities) ? b.opportunities[0] : b.opportunities))
    .filter((opportunity): opportunity is Opportunity => !!opportunity && opportunity.school_id === schoolId);

  const bookmarkIds = new Set(savedOpportunities.map((o) => o.id));

  let recommendedOpportunities: Opportunity[] = [];
  if (categories.length > 0) {
    const { data: recs } = await supabase
      .from("opportunities")
      .select("*, club:clubs(*)")
      .eq("school_id", schoolId)
      .eq("status", "approved")
      .eq("visibility", "public")
      .in("category", categories)
      .order("created_at", { ascending: false })
      .limit(8);
    recommendedOpportunities = ((recs as Opportunity[]) ?? [])
      .filter((o) => !bookmarkIds.has(o.id))
      .slice(0, 4);
  }

  let recentAnnouncements: (ClubAnnouncement & { club?: Club })[] = [];
  if (clubIds.length > 0) {
    const { data: announcements } = await supabase
      .from("club_announcements")
      .select("*, club:clubs(*)")
      .in("club_id", clubIds)
      .eq("status", "approved")
      .order("published_at", { ascending: false })
      .limit(5);
    recentAnnouncements = (announcements as (ClubAnnouncement & { club?: Club })[]) ?? [];
  }

  let upcomingAssignments: (ClubAssignment & { club?: Club })[] = [];
  if (clubIds.length > 0) {
    const { data: assignmentRows } = await supabase
      .from("club_assignments")
      .select("*, club:clubs(*)")
      .in("club_id", clubIds)
      .eq("status", "published")
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(10);
    const assignments = ((assignmentRows as (ClubAssignment & { club?: Club })[]) ?? [])
      .map((assignment) => normalizeAssignment(assignment));
    if (assignments.length > 0) {
      const { data: submissionRows } = await supabase
        .from("club_assignment_submissions")
        .select("*")
        .eq("student_id", userId)
        .in("assignment_id", assignments.map((assignment) => assignment.id));
      const submissionMap = new Map(
        ((submissionRows as ClubAssignmentSubmission[]) ?? []).map((submission) => [
          submission.assignment_id,
          submission,
        ])
      );
      upcomingAssignments = assignments.map((assignment) =>
        normalizeAssignment({ ...assignment, submission: submissionMap.get(assignment.id) ?? null })
      );
    }
  }

  return {
    memberships: schoolMemberships,
    upcomingEvents,
    upcomingAssignments,
    savedOpportunities,
    recommendedOpportunities,
    recentAnnouncements,
  };
}

export async function getUserMemberships(
  userId: string | null,
  schoolId?: string | null,
  viewer?: Profile | null
): Promise<ClubMembership[]> {
  if (!userId) return [];
  if (isDemoMode()) {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const raw = cookieStore.get("stormhub_demo_memberships")?.value;
    let joinedSlugs: string[] = [];
    try {
      joinedSlugs = raw ? JSON.parse(raw) as string[] : [...demoState.memberships];
    } catch {
      joinedSlugs = [...demoState.memberships];
    }
    return joinedSlugs
      .map((slug) => {
        const club = demoClubs.find((candidate) => candidate.slug === slug);
        if (!club || (schoolId && club.school_id !== schoolId)) return null;
        return {
          id: `demo-${slug}`,
          club_id: club.id,
          user_id: userId,
          status: "active" as const,
          role: "member" as const,
          joined_at: new Date().toISOString(),
          club,
        };
      })
      .filter(Boolean) as ClubMembership[];
  }

  const supabase = await createClient();
  if (!supabase) return [];
  const resolvedSchoolId = schoolId ?? await resolveSchoolId(undefined, viewer);
  let query = supabase
    .from("club_memberships")
    .select("*, club:clubs!inner(*)")
    .eq("user_id", userId)
    .eq("status", "active");
  if (resolvedSchoolId) query = query.eq("clubs.school_id", resolvedSchoolId);
  const { data, error } = await query.order("joined_at", { ascending: false });
  if (error) {
    console.error("[getUserMemberships]", error.message);
    return [];
  }
  return (data as ClubMembership[]) ?? [];
}

export async function getManageableClubs(profile: Profile, schoolId?: string | null): Promise<Club[]> {
  if (isDemoMode()) return isAdminRole(profile.role) ? demoClubs : [];
  const supabase = await createClient();
  if (!supabase) return [];
  if (isAdminRole(profile.role)) {
    let query = supabase.from("clubs").select("*").order("name");
    if (profile.role === "district_admin") {
      // District workspaces always choose a concrete school before loading
      // private club administration data.
      if (!profile.district_id || !schoolId) return [];
      const { data: selectedSchool } = await supabase
        .from("schools")
        .select("id")
        .eq("id", schoolId)
        .eq("district_id", profile.district_id)
        .maybeSingle();
      if (!selectedSchool) return [];
      query = query.eq("school_id", schoolId);
    } else if (profile.role === "super_admin" && schoolId) {
      query = query.eq("school_id", schoolId);
    } else if (profile.role !== "super_admin" && profile.school_id) {
      query = query.eq("school_id", profile.school_id);
    }
    const { data, error } = await query;
    if (error) {
      console.error("[getManageableClubs]", error.message);
      return [];
    }
    return (data as Club[]) ?? [];
  }
  const allowedRoles = profile.role === "teacher"
    ? ["sponsor"]
    : ["officer", "president"];
  const { data, error } = await supabase
    .from("club_memberships")
    .select("club:clubs(*)")
    .eq("user_id", profile.id)
    .eq("status", "active")
    .in("role", allowedRoles);
  if (error) {
    console.error("[getManageableClubs]", error.message);
    return [];
  }
  return ((data ?? []) as { club: Club | Club[] | null }[])
    .map((row) => Array.isArray(row.club) ? row.club[0] : row.club)
    .filter(Boolean) as Club[];
}

export async function getManagementDashboardAttention(
  clubs: Club[]
): Promise<ManagementDashboardAttention> {
  if (clubs.length === 0) {
    return {
      upcomingEvents: [],
      upcomingAssignments: [],
      grading: [],
    };
  }

  const clubIds = clubs.map((club) => club.id);
  const clubMap = new Map(clubs.map((club) => [club.id, club]));
  const now = new Date().toISOString();

  if (isDemoMode()) {
    const upcomingEvents = demoEvents
      .filter(
        (event) =>
          Boolean(event.club_id && clubIds.includes(event.club_id)) &&
          event.status === "approved" &&
          event.starts_at >= now
      )
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .slice(0, 8)
      .map((event) => ({
        ...event,
        club: event.club_id ? clubMap.get(event.club_id) ?? null : null,
      }));

    const upcomingAssignments = demoAssignments
      .filter(
        (assignment) =>
          clubIds.includes(assignment.club_id) &&
          assignment.status === "published"
      )
      .sort((a, b) =>
        (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999")
      )
      .slice(0, 12)
      .map((assignment) => ({
        ...normalizeAssignment(assignment),
        club: clubMap.get(assignment.club_id) ?? null,
      }));

    return {
      upcomingEvents,
      upcomingAssignments,
      grading: [],
    };
  }

  const supabase = await createClient();
  if (!supabase) {
    return {
      upcomingEvents: [],
      upcomingAssignments: [],
      grading: [],
    };
  }

  const [{ data: assignmentRows }, { data: eventRows }] = await Promise.all([
    supabase
      .from("club_assignments")
      .select("*, club:clubs(*)")
      .in("club_id", clubIds)
      .eq("status", "published")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(12),
    supabase
      .from("events")
      .select("*, club:clubs(*)")
      .in("club_id", clubIds)
      .eq("status", "approved")
      .gte("starts_at", now)
      .order("starts_at", { ascending: true })
      .limit(8),
  ]);

  const upcomingAssignments = (
    (assignmentRows ?? []) as (ClubAssignment & {
      club?: Club | null;
    })[]
  ).map((assignment) => normalizeAssignment(assignment));

  const assignmentIds = upcomingAssignments.map((assignment) => assignment.id);
  let grading: ManagementDashboardAttention["grading"] = [];

  if (assignmentIds.length > 0) {
    const { data: submissionRows } = await supabase
      .from("club_assignment_submissions")
      .select("assignment_id")
      .in("assignment_id", assignmentIds)
      .eq("status", "submitted");

    const submittedCounts = new Map<string, number>();
    for (const submission of (submissionRows ?? []) as {
      assignment_id: string;
    }[]) {
      submittedCounts.set(
        submission.assignment_id,
        (submittedCounts.get(submission.assignment_id) ?? 0) + 1
      );
    }

    grading = upcomingAssignments
      .map((assignment) => ({
        assignment,
        submittedCount: submittedCounts.get(assignment.id) ?? 0,
      }))
      .filter((item) => item.submittedCount > 0);
  }

  return {
    upcomingAssignments,
    upcomingEvents: (eventRows ?? []) as (Event & {
      club?: Club | null;
    })[],
    grading,
  };
}

export async function getSchoolTeachers(schoolId: string | null | undefined): Promise<Profile[]> {
  if (!schoolId || isDemoMode()) return [];
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id,school_id,full_name,email,avatar_url,role")
    .eq("school_id", schoolId)
    .eq("role", "teacher")
    .eq("account_status", "active")
    .order("full_name", { ascending: true, nullsFirst: false });
  if (error) {
    console.error("[getSchoolTeachers]", error.message);
    return [];
  }
  return (data as Profile[]) ?? [];
}

export async function getMemberClubData(slug: string, userId: string | null, clubOverride?: Club | null) {
  const club = clubOverride ?? await getClubBySlug(slug);
  if (!club) return null;
  const membership = await getUserClubMembership(userId, club.id);
  const [announcements, resources, events, assignments, directory] = await Promise.all([
    getClubAnnouncements(club.id, "members"),
    getClubResourcesByClubId(club.id),
    getClubEvents(club.id, true),
    getClubAssignments(club.id, { userId }),
    getClubMemberDirectory(club.id),
  ]);
  return { club, membership, announcements, resources, events, assignments, directory };
}

export async function trackAnalytics(
  eventType: string,
  entityType?: string,
  entityId?: string,
  metadata?: Record<string, unknown>
) {
  if (isDemoMode()) return;
  const supabase = await createClient();
  if (!supabase) return;
  const user = await getCurrentUser();
  await supabase.from("analytics_events").insert({
    school_id: user?.school_id ?? DEFAULT_SCHOOL_ID,
    user_id: user?.id,
    event_type: eventType,
    entity_type: entityType,
    entity_id: entityId,
    metadata: metadata ?? {},
  });
}

export async function getPendingApprovals(): Promise<PendingApprovalItem[]> {
  if (isDemoMode()) {
    return [
      {
        id: "demo-announcement",
        type: "announcement",
        title: "Science Bowl Practice Update",
        context: "Demo content",
        submitted_at: new Date().toISOString(),
      },
    ];
  }

  const profile = await getCurrentProfile();
  // Platform moderation is a read-only cross-tenant inventory. Load it with the
  // trusted server client so it does not disappear behind the higher-assurance
  // write guard; approval and rejection actions remain unavailable to platform
  // administrators and continue to enforce their own role checks.
  const supabase = profile?.role === "super_admin"
    ? createAdminClient() ?? await createClient()
    : await createClient();
  if (!supabase) return [];

  const [
    announcements,
    events,
    resources,
    opportunities,
  ] = await Promise.all([
    supabase.from("club_announcements").select("id,title,created_at,clubs(name)").eq("status", "pending"),
    supabase.from("events").select("id,title,created_at,clubs(name)").eq("status", "pending"),
    supabase.from("club_resources").select("id,title,created_at,clubs(name)").eq("status", "pending"),
    supabase.from("opportunities").select("id,title,created_at,clubs(name)").eq("status", "pending"),
  ]);

  const results = [announcements, events, resources, opportunities];
  const queryError = results.find((result) => result.error)?.error;
  if (queryError) {
    console.error("[getPendingApprovals]", queryError.message);
    return [];
  }

  type ClubRow = {
    id: string;
    title: string;
    created_at?: string | null;
    clubs?: { name: string } | { name: string }[] | null;
  };
  const clubName = (row: ClubRow) => {
    const club = Array.isArray(row.clubs) ? row.clubs[0] : row.clubs;
    return club?.name ?? null;
  };

  const items: PendingApprovalItem[] = [
    ...((announcements.data ?? []) as ClubRow[]).map((row) => ({
      id: row.id, type: "announcement" as const, title: row.title, context: clubName(row), submitted_at: row.created_at,
    })),
    ...((events.data ?? []) as ClubRow[]).map((row) => ({
      id: row.id, type: "event" as const, title: row.title, context: clubName(row), submitted_at: row.created_at,
    })),
    ...((resources.data ?? []) as ClubRow[]).map((row) => ({
      id: row.id, type: "resource" as const, title: row.title, context: clubName(row), submitted_at: row.created_at,
    })),
    ...((opportunities.data ?? []) as ClubRow[]).map((row) => ({
      id: row.id, type: "opportunity" as const, title: row.title, context: clubName(row), submitted_at: row.created_at,
    })),
  ];

  return items.sort((a, b) => {
    const aTime = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
    const bTime = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
    return aTime - bTime;
  });
}

export const ADMIN_USERS_PAGE_SIZE = 50;

export function normalizeAdminUserSearch(value?: string | null): string {
  return (value ?? "")
    .trim()
    .replace(/[^\p{L}\p{N}@.+\-'\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

export async function getAdminUsers(options?: {
  schoolId?: string | null;
  search?: string | null;
  role?: Profile["role"] | null;
  page?: number;
  pageSize?: number;
}): Promise<AdminUserPage> {
  const page = Number.isInteger(options?.page) && (options?.page ?? 0) > 0
    ? options!.page!
    : 1;
  const pageSize = Math.min(
    100,
    Math.max(1, Number.isInteger(options?.pageSize) ? options!.pageSize! : ADMIN_USERS_PAGE_SIZE)
  );
  const search = normalizeAdminUserSearch(options?.search);
  const emptyPage = (): AdminUserPage => ({
    users: [],
    total: 0,
    page,
    pageSize,
    totalPages: 1,
  });

  if (isDemoMode()) {
    const demoUsers: AdminUser[] = [{
      id: "demo-student",
      email: "student@example.com",
      full_name: "Demo Student",
      role: "student",
      school_id: DEFAULT_SCHOOL_ID,
      club_assignments: [],
    }];
    const matchingUsers = demoUsers.filter((user) =>
      (!options?.role || user.role === options.role)
      && (
        !search
        || `${user.full_name ?? ""} ${user.email ?? ""}`.toLowerCase().includes(search.toLowerCase())
      )
    );
    return {
      users: matchingUsers,
      total: matchingUsers.length,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(matchingUsers.length / pageSize)),
    };
  }
  const supabase = await createClient();
  if (!supabase) return emptyPage();
  const currentProfile = await getCurrentProfile();
  if (!currentProfile || !isAdminRole(currentProfile.role)) return emptyPage();

  const requestedSchoolId = options?.schoolId?.trim() || null;
  const { data, error } = await supabase.rpc("get_admin_user_inventory", {
    requested_page: page,
    requested_page_size: pageSize,
    search_text: search || null,
    requested_school_id: requestedSchoolId,
    requested_role: options?.role ?? null,
  });
  if (error) {
    console.error("[getAdminUsers]", error.message);
    return emptyPage();
  }

  type MembershipRow = {
    club_id: string;
    role: ClubMembership["role"];
    status: ClubMembership["status"];
    club_name?: string | null;
    club_slug?: string | null;
  };
  type InventoryRow = {
    user_id: string;
    school_id?: string | null;
    district_id?: string | null;
    full_name?: string | null;
    email?: string | null;
    user_role: Profile["role"];
    account_status?: Profile["account_status"];
    school_name?: string | null;
    district_name?: string | null;
    club_assignments?: MembershipRow[];
    total_count: number | string;
  };
  const rows = (data ?? []) as InventoryRow[];
  const adminUsers: AdminUser[] = rows.map((user) => ({
    id: user.user_id,
    school_id: user.school_id,
    district_id: user.district_id,
    full_name: user.full_name,
    email: user.email,
    role: user.user_role,
    account_status: user.account_status,
    school_name: user.school_name,
    district_name: user.district_name,
    club_assignments: (user.club_assignments ?? []).map((membership) => ({
      club_id: membership.club_id,
      club_name: membership.club_name ?? "Unknown club",
      club_slug: membership.club_slug ?? "",
      role: membership.role,
      status: membership.status,
    })),
  }));
  let total = Number(rows[0]?.total_count ?? 0);
  if (rows.length === 0 && page > 1) {
    const { data: countProbe, error: countProbeError } = await supabase.rpc("get_admin_user_inventory", {
      requested_page: 1,
      requested_page_size: 1,
      search_text: search || null,
      requested_school_id: requestedSchoolId,
      requested_role: options?.role ?? null,
    });
    if (countProbeError) {
      console.error("[getAdminUsers:count]", countProbeError.message);
    } else {
      total = Number(
        ((countProbe ?? []) as Array<{ total_count: number | string }>)[0]?.total_count ?? 0
      );
    }
  }
  return {
    users: adminUsers,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getClubRoster(clubId: string): Promise<ClubMembership[]> {
  if (isDemoMode()) return [];
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_club_roster", {
    club_uuid: clubId,
  });
  if (error) {
    console.error("[getClubRoster]", error.message);
    return [];
  }
  return ((data ?? []) as Array<{
    membership_id: string;
    club_id: string;
    user_id: string;
    membership_role: ClubMembership["role"];
    full_name: string;
    avatar_url?: string | null;
    email?: string | null;
  }>).map((row) => ({
    id: row.membership_id,
    club_id: row.club_id,
    user_id: row.user_id,
    status: "active",
    role: row.membership_role,
    profile: {
      id: row.user_id,
      role: row.membership_role === "sponsor" ? "teacher" : "student",
      full_name: row.full_name,
      avatar_url: row.avatar_url,
      email: row.email,
    },
  }));
}

export async function getFeedbackItems(
  schoolId: string,
  viewer?: Profile | null,
): Promise<FeedbackItem[]> {
  if (isDemoMode() || !schoolId) return [];
  const actor = viewer === undefined ? await getCurrentProfile() : viewer;
  const admin = createAdminClient();
  if (!actor || !admin || !isAdminRole(actor.role)) return [];

  const { data: school, error: schoolError } = await admin
    .from("schools")
    .select("id,district_id")
    .eq("id", schoolId)
    .maybeSingle();
  if (
    schoolError
    || !school
    || !canAccessSchoolAdmin(actor, school.id, school.district_id)
  ) {
    if (schoolError) console.error("[getFeedbackItems school]", schoolError.message);
    return [];
  }

  // Feedback is intentionally submitted for administrative review. Use the
  // server-only client after enforcing the viewer's exact tenant scope so a
  // profile join or private-data support gate cannot hide a successfully stored ticket.
  const { data, error } = await admin
    .from("feedback")
    .select("*, profile:profiles(id,full_name,email,role), school:schools(id,name,slug)")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[getFeedbackItems]", error.message);
    return [];
  }
  return (data as FeedbackItem[]) ?? [];
}
