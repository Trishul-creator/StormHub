# Account Lifecycle And Retention

District policy takes precedence over these pilot defaults. Approve the final schedule before launch.

## Lifecycle

- **Active:** can sign in and use role-authorized features.
- **Banned (stored as `suspended`):** sign-in is blocked and RLS blocks application data. Use for investigation or temporary access removal.
- **Deactivated:** sign-in is banned after graduation or departure. Records remain for approved retention periods.
- **Deletion requested:** user request awaiting administrator review. The profile remains active until reviewed.
- **Deleted:** Auth account and profile are removed; nullable authored references are detached. Immutable audit records remain.

Admins can ban/restore same-school student and teacher accounts. Super admins can act across
schools. Grade 12 cleanup deactivates active grade 12 students and records the graduation year.

## Pilot Retention

| Data | Proposed period |
| --- | --- |
| Active account/profile | While enrolled or employed |
| Deactivated profile and school participation records | School review; normally 12 months after departure unless the school requires the record |
| Pending deletion request | Resolve within 30 calendar days |
| Completed/rejected deletion request metadata | 12 months |
| Administrative audit log | 24 months |
| Support feedback | 12 months after resolution |
| In-app notifications | 12 months |
| Analytics events | 13 months |
| Email outbox metadata | 90 days |
| Digest delivery metadata | 90 days |
| Signup/request attempt hashes | 30 days |

The daily `/api/cron/data-retention` task automatically deletes expired attempt
hashes, email/digest records, notifications, resolved support messages, reviewed
deletion-request metadata, analytics, and old audit/support-session records. Each
run writes counts and completion status to `data_retention_runs`.

Accounts, coursework, memberships, attendance, and other possible school records
are not blindly deleted by the cron. They remain in the administrator-reviewed
account deletion and graduation workflow so legal holds, school record rules, and
backup-retention effects can be considered.
