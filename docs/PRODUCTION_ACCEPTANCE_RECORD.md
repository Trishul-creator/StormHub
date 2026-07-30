# Production Acceptance Record

Copy this form into the district’s private operations system for each production district. Do not
store credentials, student data, signed contracts, or private contact details in this repository.

## Release

| Field | Evidence |
| --- | --- |
| Release commit / PR | |
| Production deployment | |
| District and participating schools | |
| Technical approver and date | |
| District privacy/security approver and date | |
| District program owner and date | |

## Automated Evidence

| Gate | Required result | Evidence |
| --- | --- | --- |
| CI typecheck, lint, build, unit/component | Pass | |
| Read-only cross-browser and accessibility | Pass | |
| Database reset, pgTAP, database lint | Pass | |
| Staging authenticated E2E | Pass without retry-only failures | |
| CodeQL | Pass | |
| Production dependency audit | No moderate-or-higher production finding | |
| Migration parity | Staging and production contain every checked-in migration through `20260730270000_cross_tenant_transition_integrity.sql` | |

## Tenant And Privacy Evidence

| Test | Required result | Evidence |
| --- | --- | --- |
| Anonymous real-school table query | Denied; limited signup RPC only | |
| Student cross-school club/event/opportunity reads | Zero rows | |
| Club member directory | Limited name/role fields only | |
| Advisor/admin roster | Full roster only inside authorized scope | |
| District admin | Assigned district only | |
| Audited platform account directory | Name, verified email, school/district, role, and status only; access event recorded | |
| Platform support session | Single school, reason, read-only, audit, notification, expiration | |
| Private record boundary | Coursework, grades, attendance details, and support content absent outside scoped support | |
| Policy acceptance | Version, source, timestamp, school, and 13+ assurance recorded | |
| Account export and deletion request | Complete export; reviewed deletion succeeds | |
| Account deletion drill | Staging Auth/profile/files/tokens/mail removed or terminalized; required evidence retained | |
| Tenant offboarding | Correct requester scope, separate reviewer, reversible access suspension, completion evidence | |
| Tenant purge drill | Disposable staging tenant has zero verified database/Auth/Storage remnants; backup-expiry evidence recorded | |
| Legal hold | Active hold skips retention and blocks matching offboarding schedule/completion; reasoned release succeeds | |
| AI data flow | All AI flags false; no provider secret required | |

## Operations Evidence

| Control | Required result | Evidence |
| --- | --- | --- |
| Public `/api/health` | Only generic status/timestamp; healthy and externally monitored | |
| Bearer `/api/health` | Dedicated `HEALTH_CHECK_SECRET`; detailed checks restricted and no secret leakage | |
| Confirmation and password-reset email | Resend/Supabase SMTP delivered to external and district mailboxes; SPF/DKIM/DMARC evidence recorded | |
| hCaptcha | Supabase Auth and `/contact` reject missing/reused challenges on the production hostname | |
| Email outbox recovery | Failed retryable message is reclaimed once and sent once | |
| Weekly digest | Two invocations produce one delivery | |
| Daily retention | Completed run recorded within 26 hours | |
| Scheduled publishing | Draft stays private and releases once at the selected time | |
| Backup | Current automated backup verified | |
| Restore drill | Disposable restore passes tenant/auth/core-flow checks | |
| Restored-data deletion replay | Previously deleted test identity remains deleted | |
| Incident alert/tabletop | Owner and backup contact receive test alert; tabletop recorded | |
| Google OAuth/Drive, if enabled | Least-privilege scopes, disconnect, token deletion, and file picker pass | |
| Coursework upload intents | Exact short-lived one-time binding, quotas, signature checks, and orphan cleanup pass | |
| Untrusted-upload malware risk | Approved scanner deployed or explicit district residual-risk acceptance recorded | |
| Jurisdiction/scale review | Participating-state requirements and Nebraska design-code thresholds reviewed | |

## Contract And Provider Evidence

| Gate | Required result | Evidence |
| --- | --- | --- |
| District DPA/agreement/addendum | Executed by authorized district and provider representatives | |
| Subprocessor review | Actual production providers, plans, regions, terms, and optional Google use approved | |
| Real-device and real-account acceptance | District-managed Chromebook plus fake-role staging accounts pass | |
| Provider-console configuration | Production SMTP, CAPTCHA, OAuth when enabled, backups, cron, and monitors verified | |
| Incident route | Primary and backup contacts receive a test alert and record the response | |

## Exceptions

No unchecked item is silently waived. Record the risk, affected scope, temporary control, owner,
deadline, and named approver. A tenant-isolation, authentication, backup-restore, incident-contact,
student-data contract, or unverified provider-configuration gap blocks district production launch.
This record documents acceptance evidence; it is not a legal opinion or a claim of compliance in
every jurisdiction.
