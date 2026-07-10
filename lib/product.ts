import type { Club, Event, Notification, Opportunity, Profile, UserRole } from "@/types/database";

export type OnboardingStatus = "done" | "active" | "locked";

export interface OnboardingSignals {
  joinedClubs?: number;
  savedOpportunities?: number;
  rsvpedEvents?: number;
  manageableClubs?: number;
  pendingApprovals?: number;
  rosterMembers?: number;
  usersManaged?: number;
  activeClubs?: number;
  recentActivity?: number;
}

export interface OnboardingItem {
  id: string;
  label: string;
  description: string;
  href: string;
  status: OnboardingStatus;
}

export function getRoleOnboardingItems(role: UserRole, signals: OnboardingSignals = {}): OnboardingItem[] {
  if (role === "student") {
    return [
      {
        id: "join-club",
        label: "Join a club",
        description: "Pick at least one club so announcements and member events show up in your dashboard.",
        href: "/clubs",
        status: (signals.joinedClubs ?? 0) > 0 ? "done" : "active",
      },
      {
        id: "save-opportunity",
        label: "Save an opportunity",
        description: "Bookmark deadlines, tryouts, auditions, or applications you may want to revisit.",
        href: "/opportunities",
        status: (signals.savedOpportunities ?? 0) > 0 ? "done" : "active",
      },
      {
        id: "rsvp-event",
        label: "RSVP to an event",
        description: "RSVPs help students plan and help sponsors understand expected turnout.",
        href: "/calendar",
        status: (signals.rsvpedEvents ?? 0) > 0 ? "done" : "active",
      },
    ];
  }

  if (role === "teacher") {
    return [
      {
        id: "review-clubs",
        label: "Open your club command center",
        description: "Manage announcements, events, resources, and roster changes from one place.",
        href: "/manage",
        status: (signals.manageableClubs ?? 0) > 0 ? "done" : "active",
      },
      {
        id: "review-approvals",
        label: "Review pending approvals",
        description: "Approve or send back student-created content that needs sponsor attention.",
        href: "/manage/approvals",
        status: (signals.pendingApprovals ?? 0) === 0 ? "done" : "active",
      },
      {
        id: "manage-roster",
        label: "Check club rosters",
        description: "Keep sponsors, officers, presidents, and members accurate before events start.",
        href: "/manage/clubs",
        status: (signals.manageableClubs ?? 0) > 0 ? "active" : "locked",
      },
    ];
  }

  return [
    {
      id: "review-approvals",
      label: "Review school approvals",
      description: "Clear pending announcements, events, resources, and opportunities before families see stale queues.",
      href: "/manage/approvals",
      status: (signals.pendingApprovals ?? 0) === 0 ? "done" : "active",
    },
    {
      id: "manage-users",
      label: "Verify users and roles",
      description: "Confirm students, teachers, sponsors, and administrators have the right access.",
      href: "/admin/users",
      status: (signals.usersManaged ?? 0) > 0 ? "done" : "active",
    },
    {
      id: "inspect-activity",
      label: "Inspect school activity",
      description: "Review active clubs, upcoming events, signups, and recent platform usage.",
      href: "/manage/analytics",
      status: (signals.activeClubs ?? 0) > 0 || (signals.recentActivity ?? 0) > 0 ? "active" : "locked",
    },
  ];
}

export type NotificationGroupId = "approvals" | "events" | "club_updates" | "opportunities" | "admin" | "other";

export interface NotificationGroup {
  id: NotificationGroupId;
  label: string;
  notifications: Notification[];
  unreadCount: number;
}

const notificationGroupLabels: Record<NotificationGroupId, string> = {
  approvals: "Approvals",
  events: "Events and RSVPs",
  club_updates: "Club updates",
  opportunities: "Opportunities",
  admin: "Admin actions",
  other: "Other",
};

export function getNotificationGroupId(type: string): NotificationGroupId {
  if (type === "approval_needed" || type === "content_approved" || type === "content_rejected") return "approvals";
  if (type.includes("event")) return "events";
  if (type.includes("opportunity") || type.includes("deadline")) return "opportunities";
  if (type.includes("club")) return "club_updates";
  if (type.includes("admin") || type === "system_message") return "admin";
  return "other";
}

export function groupNotifications(notifications: Notification[]): NotificationGroup[] {
  const order: NotificationGroupId[] = ["approvals", "events", "club_updates", "opportunities", "admin", "other"];
  const grouped = new Map<NotificationGroupId, Notification[]>();
  notifications.forEach((notification) => {
    const id = getNotificationGroupId(notification.type);
    grouped.set(id, [...(grouped.get(id) ?? []), notification]);
  });
  return order
    .map((id) => {
      const items = grouped.get(id) ?? [];
      return {
        id,
        label: notificationGroupLabels[id],
        notifications: items,
        unreadCount: items.filter((item) => !item.read_at).length,
      };
    })
    .filter((group) => group.notifications.length > 0);
}

export type SearchResultType = "club" | "event" | "opportunity" | "resource" | "person";

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  description?: string | null;
  href: string;
  context?: string | null;
  score: number;
}

function matchScore(query: string, values: Array<string | null | undefined>): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  return values.reduce((score, value, index) => {
    const text = value?.toLowerCase();
    if (!text) return score;
    if (text === q) return score + 100 - index * 5;
    if (text.startsWith(q)) return score + 60 - index * 5;
    if (text.includes(q)) return score + 25 - index * 3;
    return score;
  }, 0);
}

export function buildGlobalSearchResults(input: {
  query: string;
  clubs?: Club[];
  events?: Event[];
  opportunities?: Opportunity[];
  people?: Profile[];
}): SearchResult[] {
  const query = input.query.trim();
  if (query.length < 2) return [];

  const results: SearchResult[] = [];
  for (const club of input.clubs ?? []) {
    const score = matchScore(query, [club.name, club.category, club.short_description, ...(club.tags ?? [])]);
    if (score > 0) {
      results.push({
        id: club.id,
        type: "club",
        title: club.name,
        description: club.short_description,
        href: `/clubs/${club.slug}`,
        context: club.category,
        score,
      });
    }
  }

  for (const event of input.events ?? []) {
    const score = matchScore(query, [event.title, event.description, event.event_type, event.club?.name]);
    if (score > 0) {
      results.push({
        id: event.id,
        type: "event",
        title: event.title,
        description: event.description,
        href: `/events/${event.id}`,
        context: event.club?.name ?? "School event",
        score,
      });
    }
  }

  for (const opportunity of input.opportunities ?? []) {
    const score = matchScore(query, [
      opportunity.title,
      opportunity.category,
      opportunity.summary,
      opportunity.description,
      ...(opportunity.tags ?? []),
    ]);
    if (score > 0) {
      results.push({
        id: opportunity.id,
        type: "opportunity",
        title: opportunity.title,
        description: opportunity.summary,
        href: `/opportunities/${opportunity.slug}`,
        context: opportunity.category,
        score,
      });
    }
  }

  for (const person of input.people ?? []) {
    const score = matchScore(query, [person.full_name, person.email, person.role]);
    if (score > 0) {
      results.push({
        id: person.id,
        type: "person",
        title: person.full_name || person.email || "Unnamed user",
        description: person.email,
        href: "/admin/users",
        context: person.role,
        score,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, 12);
}

export function buildDiscoveryHints(input: {
  joinedCategory?: string | null;
  hasJoinedClubs: boolean;
  hasSavedOpportunities: boolean;
}) {
  const hints = [];
  if (!input.hasJoinedClubs) {
    hints.push({ label: "Start with clubs", href: "/clubs?featured=true" });
  }
  if (!input.hasSavedOpportunities) {
    hints.push({ label: "Find deadlines", href: "/opportunities?closing=true" });
  }
  if (input.joinedCategory) {
    hints.push({ label: `More ${input.joinedCategory}`, href: `/opportunities?category=${encodeURIComponent(input.joinedCategory)}` });
  }
  return hints;
}

export type EmptyStateSurface = "clubs" | "opportunities" | "search";

export interface EmptyStateAction {
  label: string;
  href: string;
}

function searchHref(pathname: string, params: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const queryString = query.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

export function buildEmptyStateActions(input: {
  surface: EmptyStateSurface;
  query?: string;
  category?: string;
  filter?: string;
  grade?: string;
  closing?: string;
  isAdmin?: boolean;
}): EmptyStateAction[] {
  const hasSearchOrFilter = Boolean(input.query || input.category || input.filter || input.grade || input.closing);

  if (input.surface === "clubs") {
    return [
      ...(hasSearchOrFilter ? [{ label: "Clear filters", href: "/clubs" }] : []),
      { label: "Featured clubs", href: "/clubs?featured=true" },
      ...(input.query ? [{ label: "Search everything", href: searchHref("/search", { q: input.query }) }] : []),
      ...(input.isAdmin ? [{ label: "Create club", href: "/manage/clubs/new" }] : []),
    ];
  }

  if (input.surface === "opportunities") {
    return [
      ...(hasSearchOrFilter ? [{ label: "Clear filters", href: "/opportunities" }] : []),
      { label: "Closing soon", href: "/opportunities?closing=true" },
      ...(input.query ? [{ label: "Search everything", href: searchHref("/search", { q: input.query }) }] : []),
      ...(input.isAdmin ? [{ label: "Create opportunity", href: "/manage/opportunities" }] : []),
    ];
  }

  return [
    ...(input.query ? [{ label: "Search clubs", href: searchHref("/clubs", { q: input.query }) }] : []),
    ...(input.query ? [{ label: "Search opportunities", href: searchHref("/opportunities", { q: input.query }) }] : []),
    { label: "Browse calendar", href: "/calendar" },
    { label: "Contact school team", href: "/contact" },
  ];
}
