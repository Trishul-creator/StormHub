# Incident Response

## Roles

- Incident lead: owns containment and status updates.
- Technical lead: investigates Vercel, Supabase, and email delivery.
- School contact: coordinates student/staff communication.
- Privacy contact: evaluates student-data exposure and district reporting duties.

Store current names and phone numbers in the district's private operations system, not this repository.

## Severity

- **SEV-1:** suspected account/data exposure, cross-school access, administrator compromise, or broad outage.
- **SEV-2:** important workflow unavailable, repeated email failures, or one school unavailable.
- **SEV-3:** isolated defect with a workaround and no security impact.

## First 30 Minutes

1. Record discovery time, reporter, affected users/schools, and the last known good deployment.
2. Preserve Vercel logs, Supabase Auth/Postgres logs, audit rows, and deployment identifiers.
3. For suspected account compromise, suspend the account, revoke sessions in Supabase, rotate its
   factor, and review `admin_audit_log`.
4. For suspected key exposure, rotate the affected Supabase, Resend, hCaptcha, Groq, or Vercel secret.
5. Disable the affected feature. Set all AI flags false for any assistant/privacy concern.
6. If integrity is uncertain, stop writes by enabling maintenance controls or rolling back the app;
   do not delete evidence.
7. Notify the district privacy/security contact for every SEV-1 event.

## Diagnosis

- Check `/api/health` and the external uptime timeline.
- Compare the failing deployment with the previous production deployment.
- Review Vercel function logs by request ID and structured event name.
- Review Supabase Auth logs, Postgres logs, migration history, and `admin_audit_log`.
- Review email provider logs and `email_outbox`/`digest_deliveries` for delivery incidents.
- Test with a non-privileged account before declaring a permissions issue resolved.

## Recovery

1. Fix forward on a branch and require all protected checks.
2. For application-only regressions, promote the last known good Vercel deployment while the fix runs.
3. For data corruption, stop writes, preserve a snapshot, and follow `BACKUP_AND_RECOVERY.md`.
4. Confirm health, authentication, school isolation, admin MFA, and the affected user flow.
5. Monitor for at least 30 minutes after recovery.

## Afterward

Within two school days, document timeline, impact, root cause, detection gap, remediation, and owner.
Create tracked follow-up work and test the specific failure mode. Do not include student PII in the
repository or public issue tracker.
