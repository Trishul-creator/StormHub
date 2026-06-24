export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function table() {
  return { Row: {} as Row, Insert: {} as Row, Update: {} as Row, Relationships: [] as never[] };
}

export interface Database {
  public: {
    Tables: {
      schools: ReturnType<typeof table>;
      profiles: ReturnType<typeof table>;
      clubs: ReturnType<typeof table>;
      club_memberships: ReturnType<typeof table>;
      club_announcements: ReturnType<typeof table>;
      club_resources: ReturnType<typeof table>;
      opportunities: ReturnType<typeof table>;
      events: ReturnType<typeof table>;
      event_rsvps: ReturnType<typeof table>;
      bookmarks: ReturnType<typeof table>;
      workshops: ReturnType<typeof table>;
      service_hours: ReturnType<typeof table>;
      feedback: ReturnType<typeof table>;
      analytics_events: ReturnType<typeof table>;
      interest_forms: ReturnType<typeof table>;
      approval_requests: ReturnType<typeof table>;
      notifications: ReturnType<typeof table>;
      notification_preferences: ReturnType<typeof table>;
      email_outbox: ReturnType<typeof table>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
