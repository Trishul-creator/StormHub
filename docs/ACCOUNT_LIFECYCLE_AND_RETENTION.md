# Account Lifecycle And Retention

District policy takes precedence over these pilot defaults. Approve the final schedule before launch.

## Lifecycle

- **Active:** can sign in and use role-authorized features.
- **Banned (stored as `suspended`):** sign-in is blocked and RLS blocks application data. Use for investigation or temporary access removal.
- **Deactivated:** sign-in is banned after graduation or departure. Records remain for approved retention periods.
- **Deletion requested:** user request awaiting administrator review. The profile remains active until reviewed.
- **Deleted:** Auth account and profile are removed; nullable authored references are detached. Immutable audit records remain.
- **Tenant offboarding:** a school or district instruction is reviewed separately. Platform approval
  first makes the tenant inactive/private and preserves a restore snapshot; physical purge requires
  the verified process in `docs/TENANT_OFFBOARDING.md`.

Admins can ban/restore same-school student and teacher accounts. Super admins can act across
schools. Grade 12 cleanup deactivates active grade 12 students and records the graduation year.

## Pilot Retention

| Data | Proposed period |
| --- | --- |
| Active account/profile | While enrolled or employed |
| Policy acceptance and 13+ assurance | While the authentication account is active |
| Encrypted Google Drive connection | Until disconnect or account deletion |
| Deactivated profile and school participation records | School review; normally 12 months after departure unless the school requires the record |
| Pending deletion request | Resolve within 30 calendar days |
| Completed/rejected deletion request metadata | 12 months |
| Tenant offboarding request and event history | District agreement; normally at least 24 months after completion |
| Administrative audit log | 24 months |
| Account-deletion execution evidence | 24 months |
| Platform support sessions and access events | 24 months |
| Support feedback | 12 months after resolution |
| In-app notifications | 12 months |
| Analytics events | 13 months |
| Email outbox metadata | 90 days |
| Digest delivery metadata | 90 days |
| Signup/request attempt hashes | 30 days |
| Registered coursework upload intents | 30 days after registration |
| Rejected/expired coursework upload intents | 7 days after expiry; abandoned private object removed first |

The daily `/api/cron/data-retention` task automatically deletes expired attempt
hashes, email/digest records, notifications, resolved support messages, reviewed
deletion-request metadata, analytics, and old audit/support-session records. Each
run writes counts and completion status to `data_retention_runs`.

Pending coursework upload intents expire after ten minutes. After a conservative three-hour
signed-token grace period, the retention worker repeatedly removes any private object associated
with an expired or rejected intent. It retains that terminal row for seven days so a late token
cannot create an untracked object, and removes registered intent metadata after 30 days. The
durable assignment/submission attachment record remains under the school-reviewed coursework
lifecycle.

Accounts, coursework, memberships, attendance, and other possible school records
are not blindly deleted by the cron. They remain in the administrator-reviewed
account deletion and graduation workflow so legal holds, school record rules, and
backup-retention effects can be considered.

The current rollout is high-school-only and blocks signup without an age-13-or-older assurance.
StormHub does not collect a birth date. An under-13 deployment stays disabled until a separately
approved school authorization/consent workflow and age-appropriate notice are implemented.
