# StormHub District Privacy And Security Addendum

This is a ready-to-review contract template, not an executed agreement, legal advice, certification,
or a claim of compliance in every jurisdiction. Replace the bracketed party and notice details,
have authorized district and StormHub representatives and their advisers review it, and sign it
before a district-wide production launch.

## 1. Parties And Purpose

This Addendum is between **[District legal name and address]** (“District”) and
**[StormHub operating legal entity and address]** (“Provider”), effective **[date]**. It governs
Provider’s processing of student, staff, and school information to supply the StormHub club,
opportunity, event, communication, and club-coursework service described in the parties’ order or
pilot agreement.

District determines the educational purpose, participating schools, authorized accounts, and
record-retention instructions. Provider processes covered information only to deliver, secure,
support, and maintain that authorized service.

## 2. Covered Information

Covered information may include account and role data; school, district, club, membership,
attendance, RSVP, and opportunity records; assignments, submissions, attachments, scores, and
feedback; support requests; administrative audit events; limited product analytics; authentication
and abuse-prevention records; and optional Google Drive connection and selected-file metadata.
StormHub does not require payment-card data, a birth date, precise location, advertising profiles,
or official report-card grades.

## 3. FERPA And School Control

To the extent the Family Educational Rights and Privacy Act applies, the parties intend Provider
to perform an institutional service or function for which District would otherwise use its own
employees. Provider will:

- use education records only for the purpose described in this Addendum and District’s written
  instructions;
- remain under District’s direct control with respect to the use and maintenance of education
  records;
- not redisclose education records except as authorized by District or permitted by law;
- support District’s process for access, correction, export, and deletion requests; and
- not use school-controlled information to build advertising profiles or for an unrelated
  commercial purpose.

District remains responsible for its annual FERPA notice, legitimate-educational-interest criteria,
and any required record of disclosure.

## 4. Children And Authorized Users

The current production configuration is for high-school communities and requires each signup to
assure that the person is age 13 or older. It does not collect a birth date. District will not
enable or direct an account for a child under 13. An elementary or middle-school deployment that
may include a child under 13 requires a separately approved implementation, age-appropriate
notice, and documented school authorization or parental-consent process before access is enabled.

## 5. Provider Commitments

Provider will not:

- sell or rent covered information;
- use covered information for targeted or behavioral advertising;
- create a student profile except for the authorized school purpose;
- knowingly retain covered information beyond the approved schedule; or
- enable external AI processing of covered information unless District separately approves the
  vendor, data flow, terms, and updated notice in writing.

Provider will use trained, authorized personnel and subprocessors bound to confidentiality and
data-protection obligations. The current subprocessor register is maintained in
`docs/SUBPROCESSOR_REGISTER.md`.

## 6. Security Controls

Provider maintains reasonable administrative, technical, and organizational controls, including:

- verified-email authentication, school access codes, scoped roles, suspended-account enforcement,
  CAPTCHA, request throttling, and individual administrator accounts;
- row-level tenant isolation, private object storage, short-lived file links, encrypted Google
  Drive tokens, service-secret separation, and strict file-type/size/count limits;
- short-lived, one-time coursework upload authorizations bound to the exact user, assignment,
  destination, object path, file name, declared type, and size, with preparation quotas and
  abandoned-object cleanup;
- administrative audit events and time-limited, reason-required, read-only platform support
  sessions that notify the affected school;
- automated dependency, static-analysis, browser, accessibility, migration, database-lint, and
  row-level-security tests before release;
- encrypted backups, a documented restore drill, health monitoring, email-delivery recovery, and
  daily retention processing; and
- an incident-response process that preserves evidence and coordinates with the affected District.

Multi-factor authentication is not required in the current high-school rollout. Compensating
controls are confirmed email, CAPTCHA, private school access codes, scoped authorization,
administrator account separation, session revocation, audit logging, and account suspension.
Provider will reassess stronger authentication before materially expanding privileged access or
when District policy requires it.

File extension, media-type, size, and file-signature validation are not malware scanning. Before
allowing broad untrusted direct uploads in a district production deployment, the parties must
record either an approved malware-scanning control or District’s written acceptance of the
remaining risk for private, signature-validated downloads.

## 7. Access And Support

School administrators can access records only for their school; district administrators only for
their district. Authorized platform administrators may use an audited service-wide account
directory containing account name, verified email, school or district, role, and account status
for account administration, security response, and access support. That directory does not expose
private coursework, grades, attendance details, or support-message content.

Private coursework, attendance details, and support-message content are not available through
ordinary platform administration. When troubleshooting requires that record visibility, a
platform administrator must open a reason-required, read-only support session for a single school.
The session expires within 60 minutes, is logged, and notifies school administrators. Provider
will not place student support-message content in ordinary support email; email receives only a
generic alert to review the scoped in-app request.

## 8. Retention, Return, And Deletion

Provider will apply the public retention schedule and District’s lawful written instructions.
Transient security attempts are retained 30 days; email and digest delivery data 90 days;
notifications and resolved support records 12 months; identifiable analytics 13 months; and
administrative audit/support-access records 24 months, unless a documented legal hold applies.
Account, coursework, attendance, and other possible education records use an administrator-reviewed
workflow instead of blind deletion.

Provider maintains a reason-recorded legal-hold registry restricted to platform administrators.
An active hold pauses automatic retention deletion, and a matching district or school hold blocks
offboarding from being scheduled or marked complete until an authorized platform administrator
records a reasoned release. The parties acknowledge that this conservative control may retain
otherwise expired operational information while any active hold is being resolved.

On termination or District instruction, Provider will make an agreed export available, delete or
de-identify covered information that District does not require preserved, revoke active access,
and document completion. School and district removal uses a reviewed offboarding workflow:
authorized school or district administrators may request removal within their scope, while a
platform administrator performs final approval. Approval first disables tenant access and
preserves a recoverable state snapshot; it does not physically purge records. Physical purge
requires separate export, hold, retention, evidence, and separation-of-duty checks. Deletions will
also be applied after a backup restore before the restored environment returns to service.
Encrypted backups age out under the approved backup schedule unless a legal hold requires
temporary preservation.

## 9. Incident Response

Provider will notify District’s designated privacy/security contact without unreasonable delay
after confirming unauthorized access to covered information and will provide the known nature,
affected scope, containment, corrective action, and information reasonably needed for District’s
legal analysis. The parties will coordinate notices; neither party will name the other publicly
without authorization unless required by law.

## 10. Verification And Changes

Provider will supply reasonable evidence of applicable controls, test results, subprocessors,
retention runs, and support-access logs, subject to security and confidentiality limits. Material
changes to processing, subprocessors, or the student privacy notice will be communicated before
they apply to District. District may terminate the affected service if the parties cannot agree on
a material change.

## 11. Order Of Precedence And Term

If this Addendum conflicts with the service agreement on student-data protection, this Addendum
controls. It remains in effect while Provider holds covered information. Applicable law,
indemnification, insurance, payment, and venue must be completed in the signed service agreement;
this template does not supply those business terms.

## 12. Notices And Signatures

| | District | Provider |
| --- | --- | --- |
| Legal name | [complete] | [complete] |
| Privacy/security notice email | [complete] | [complete] |
| Notice address | [complete] | [complete] |
| Authorized signer | [complete] | [complete] |
| Title | [complete] | [complete] |
| Signature | [complete] | [complete] |
| Date | [complete] | [complete] |
