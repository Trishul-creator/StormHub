# StormHub Subprocessor Register

Review this register before each district agreement and at least annually. The contract owner must
confirm the current legal entity, hosting region, security documentation, and student-data terms
for the actual plan in use. A repository row is not district approval: record the signed or
otherwise authorized review in the district's private contract system. Do not enable an optional
provider merely because it appears here.

| Provider | Purpose | Data involved | Required configuration |
| --- | --- | --- | --- |
| Supabase | Authentication, PostgreSQL database, private file storage | Account, school, club, coursework, audit, support, security, and stored-file data | US/district-approved region; RLS enabled; service key server-only; email confirmation; backups verified |
| Vercel | Web hosting, server execution, scheduled jobs, logs | Requests, limited network/device data, application errors, and data processed by server functions | Production/staging separation; sensitive variables server-only; log access restricted; health monitoring |
| Resend | Transactional application email and Supabase custom SMTP | Recipient email, subject, and required notification content | Verified StormHub domain; SPF/DKIM/DMARC; no marketing use; support requests use generic alerts |
| hCaptcha | Bot and abuse protection | Challenge result plus network/browser/device signals needed to detect abuse | Hostnames restricted; secret stored only in Supabase/Vercel; privacy notice displayed |
| Google | Optional Google sign-in, Drive file selection/copy, and the currently configured direct support mailbox | Google account identity; encrypted OAuth tokens; selected file metadata and user-authorized copies; a generic in-app support alert with no requester details; direct-email content only when a person separately chooses to email the mailbox | Separate least-privilege OAuth clients; `openid`, `email`, and `drive.file` only; user disconnect/revocation supported; use a district-approved managed support mailbox and restrict mailbox access |

## Change Procedure

1. Document purpose, data categories, locations, retention, security terms, and contract owner.
2. Determine whether the district agreement requires advance notice or approval.
3. Complete security/privacy review and update the Privacy Notice before production data flows.
4. Keep AI providers disabled unless a district separately approves the exact provider and flow.
5. Record approval date, reviewer, and evidence in the private district operations record.

Public repository documents must not contain provider secrets, signed agreements, student data, or
private district contact details.
