export type UserRole =
  | "student"
  | "teacher"
  | "admin"
  | "super_admin";

export type ClubStatus = "draft" | "interest_open" | "active" | "paused" | "archived";

export type ContentStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "archived";

export type Visibility = "public" | "members" | "officers" | "private" | "unlisted";

export type MembershipStatus = "pending" | "active" | "rejected" | "left";

export type MembershipRole =
  | "member"
  | "officer"
  | "president"
  | "sponsor";

export type EventType =
  | "meeting"
  | "practice"
  | "info_session"
  | "competition"
  | "workshop"
  | "audition"
  | "deadline"
  | "other";

export type RSVPStatus = "going" | "interested" | "not_going" | "waitlisted";
export type NotificationImportance = "normal" | "important" | "urgent";
export type NotificationType =
  | "club_announcement"
  | "club_event_created"
  | "club_event_updated"
  | "club_event_canceled"
  | "club_opportunity_created"
  | "opportunity_deadline_soon"
  | "approval_needed"
  | "content_approved"
  | "content_rejected"
  | "system_message";

export interface School {
  id: string;
  name: string;
  slug: string;
  short_name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  website_url?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  mascot?: string | null;
  is_active?: boolean;
  is_public?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Profile {
  id: string;
  school_id?: string | null;
  full_name?: string | null;
  email?: string | null;
  grade_level?: number | null;
  avatar_url?: string | null;
  role: UserRole;
  created_at?: string;
  updated_at?: string;
}

export interface Club {
  id: string;
  school_id: string;
  name: string;
  slug: string;
  short_description?: string | null;
  long_description?: string | null;
  category?: string | null;
  tags?: string[];
  sponsor_name?: string | null;
  sponsor_email?: string | null;
  meeting_time?: string | null;
  meeting_location?: string | null;
  join_instructions?: string | null;
  is_featured: boolean;
  is_listed: boolean;
  status: ClubStatus;
  is_active: boolean;
  visibility: Visibility;
  created_at?: string;
  updated_at?: string;
  member_count?: number;
}

export interface ClubMembership {
  id: string;
  club_id: string;
  user_id: string;
  status: MembershipStatus;
  role: MembershipRole;
  joined_at?: string;
  club?: Club;
  profile?: Profile;
}

export interface AdminUser extends Profile {
  club_assignments: Array<{
    club_id: string;
    club_name: string;
    club_slug: string;
    role: MembershipRole;
    status: MembershipStatus;
  }>;
}

export interface ClubAnnouncement {
  id: string;
  club_id: string;
  author_id?: string | null;
  title: string;
  body: string;
  visibility: Visibility;
  status: ContentStatus;
  importance?: NotificationImportance;
  send_email_to_members?: boolean;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ClubResource {
  id: string;
  club_id: string;
  author_id?: string | null;
  title: string;
  description?: string | null;
  resource_type: "link" | "file" | "text";
  url?: string | null;
  content?: string | null;
  visibility: Visibility;
  status: ContentStatus;
  created_at?: string;
  updated_at?: string;
}

export interface Opportunity {
  id: string;
  school_id: string;
  club_id?: string | null;
  author_id?: string | null;
  title: string;
  slug: string;
  summary?: string | null;
  description?: string | null;
  category?: string | null;
  tags?: string[];
  eligibility?: string | null;
  grade_min?: number | null;
  grade_max?: number | null;
  deadline?: string | null;
  event_date?: string | null;
  location?: string | null;
  external_url?: string | null;
  action_label?: string | null;
  status: ContentStatus;
  visibility: Visibility;
  importance?: NotificationImportance;
  send_email_to_members?: boolean;
  deadline_reminder_enabled?: boolean;
  created_at?: string;
  updated_at?: string;
  club?: Club | null;
}

export interface Event {
  id: string;
  school_id: string;
  club_id?: string | null;
  title: string;
  slug?: string | null;
  description?: string | null;
  event_type: EventType;
  starts_at: string;
  ends_at?: string | null;
  location?: string | null;
  external_url?: string | null;
  max_attendees?: number | null;
  visibility: Visibility;
  status: ContentStatus;
  importance?: NotificationImportance;
  send_email_to_members?: boolean;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  club?: Club | null;
  rsvp_count?: number;
}

export interface EventRSVP {
  id: string;
  event_id: string;
  user_id: string;
  status: RSVPStatus;
  created_at?: string;
}

export interface Bookmark {
  id: string;
  user_id: string;
  opportunity_id?: string | null;
  event_id?: string | null;
  club_id?: string | null;
  created_at?: string;
}

export interface Workshop {
  id: string;
  school_id: string;
  club_id?: string | null;
  host_user_id?: string | null;
  title: string;
  description?: string | null;
  subject_area?: string | null;
  skill_level?: string | null;
  starts_at?: string | null;
  location?: string | null;
  signup_url?: string | null;
  status: ContentStatus;
  created_at?: string;
  updated_at?: string;
}

export interface ServiceHour {
  id: string;
  user_id: string;
  club_id?: string | null;
  opportunity_id?: string | null;
  title: string;
  organization?: string | null;
  date_completed: string;
  hours: number;
  description?: string | null;
  status: "draft" | "submitted" | "approved" | "rejected";
  approved_by?: string | null;
  reviewed_at?: string | null;
  reviewer_notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type ApprovalContentType =
  | "announcement"
  | "event"
  | "resource"
  | "opportunity"
  | "workshop";

export interface PendingApprovalItem {
  id: string;
  type: ApprovalContentType;
  title: string;
  context?: string | null;
  submitted_at?: string | null;
}

export interface Feedback {
  id: string;
  school_id: string;
  user_id?: string | null;
  name?: string | null;
  email?: string | null;
  message: string;
  category?: string | null;
  status: "open" | "reviewed" | "resolved";
  created_at?: string;
}

export interface Notification {
  id: string;
  recipient_user_id: string;
  type: NotificationType;
  importance: NotificationImportance;
  title: string;
  message: string;
  link?: string | null;
  club_id?: string | null;
  opportunity_id?: string | null;
  event_id?: string | null;
  read_at?: string | null;
  created_at: string;
  club?: Pick<Club, "id" | "name" | "slug"> | null;
}

export interface NotificationPreferences {
  id?: string;
  user_id: string;
  in_app_enabled: boolean;
  club_updates_enabled: boolean;
  opportunity_deadlines_enabled: boolean;
  important_email_enabled: boolean;
  urgent_email_enabled: boolean;
  admin_attention_email_enabled: boolean;
  weekly_digest_enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export type FeedbackStatus = "open" | "reviewed" | "resolved";

export interface FeedbackItem {
  id: string;
  school_id: string;
  user_id?: string | null;
  name?: string | null;
  email?: string | null;
  message: string;
  category?: string | null;
  status: FeedbackStatus;
  created_at?: string;
  profile?: Pick<Profile, "id" | "full_name" | "email" | "role"> | null;
}

export interface EmailOutboxItem {
  id: string;
  recipient_user_id?: string | null;
  recipient_email: string;
  subject: string;
  body: string;
  type: string;
  status: "pending" | "sent" | "failed" | "simulated";
  error_message?: string | null;
  sent_at?: string | null;
  created_at: string;
}

export interface AnalyticsSummary {
  totalClubs: number;
  activeClubs: number;
  totalStudents: number;
  totalMemberships: number;
  upcomingEvents: number;
  totalOpportunities: number;
  totalRsvps: number;
  totalBookmarks: number;
  mostJoinedClubs: { name: string; slug: string; count: number }[];
  recentActivity: { type: string; description: string; created_at: string }[];
}

export interface StudentDashboard {
  memberships: ClubMembership[];
  upcomingEvents: Event[];
  savedOpportunities: Opportunity[];
  recommendedOpportunities: Opportunity[];
  recentAnnouncements: (ClubAnnouncement & { club?: Club })[];
}
