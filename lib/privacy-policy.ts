export const PRIVACY_NOTICE_EFFECTIVE_DATE = "July 28, 2026";

export const RETENTION_DAYS = {
  signupAttempts: 30,
  requestAttempts: 30,
  emailOutbox: 90,
  digestDeliveries: 90,
  notifications: 365,
  resolvedSupport: 365,
  reviewedDeletionRequests: 365,
  analyticsEvents: 395,
  adminAudit: 730,
  platformSupportSessions: 730,
  retentionRunHistory: 730,
} as const;

export const RETENTION_SCHEDULE = [
  {
    data: "Active account and profile",
    period: "While the person is enrolled, employed, or otherwise authorized by the school",
    handling: "Deleted on an approved account request or school instruction, subject to required school records.",
  },
  {
    data: "Club memberships, RSVPs, attendance, coursework, grades, and submissions",
    period: "While needed for the school activity and its approved record schedule",
    handling: "Account deletion removes or detaches private user content where permitted; school-authored records may remain without the deleted identity.",
  },
  {
    data: "Signup and abuse-prevention attempt hashes",
    period: "30 days",
    handling: "Automatically deleted. Raw IP addresses and signup emails are not stored in these attempt tables.",
  },
  {
    data: "Email delivery and weekly-digest records",
    period: "90 days",
    handling: "Automatically deleted, including stored email bodies and delivery errors.",
  },
  {
    data: "In-app notifications",
    period: "12 months",
    handling: "Automatically deleted.",
  },
  {
    data: "Resolved contact and support messages",
    period: "12 months after resolution",
    handling: "Automatically deleted.",
  },
  {
    data: "Completed or rejected deletion-request records",
    period: "12 months after review",
    handling: "Automatically deleted.",
  },
  {
    data: "Identifiable product and participation analytics",
    period: "13 months",
    handling: "Automatically deleted. Aggregate counts that no longer identify a person may be retained.",
  },
  {
    data: "Administrative audit and platform support-access records",
    period: "24 months",
    handling: "Automatically deleted unless a security investigation or legal hold requires temporary preservation.",
  },
] as const;
