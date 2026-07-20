# Account Lifecycle And Retention

District policy takes precedence over these pilot defaults. Approve the final schedule before launch.

## Lifecycle

- **Active:** can sign in and use role-authorized features.
- **Suspended:** sign-in is banned and RLS blocks application data. Use for investigation or temporary access removal.
- **Deactivated:** sign-in is banned after graduation or departure. Records remain for approved retention periods.
- **Deletion requested:** user request awaiting administrator review. The profile remains active until reviewed.
- **Deleted:** Auth account and profile are removed; nullable authored references are detached. Immutable audit records remain.

Admins can suspend/reactivate same-school student and teacher accounts. Super admins can act across
schools. Grade 12 cleanup deactivates active grade 12 students and records the graduation year.

## Proposed Pilot Retention

| Data | Proposed period |
| --- | --- |
| Active account/profile | While enrolled or employed |
| Deactivated profile and participation records | 12 months after departure |
| Pending deletion request | Resolve within 30 calendar days |
| Completed/rejected deletion request metadata | 12 months |
| Administrative audit log | 24 months |
| Support feedback | 12 months after resolution |
| Analytics events | 13 months |
| Email outbox metadata | 90 days |
| Digest delivery metadata | 90 days |
| Signup/request attempt hashes | 30 days |

Create a monthly operations ticket to review deletion requests and remove records past retention.
Before deleting anything, check legal holds, district record rules, and backup-retention effects.
