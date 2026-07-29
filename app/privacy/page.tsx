import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PRIVACY_NOTICE_EFFECTIVE_DATE,
  RETENTION_SCHEDULE,
} from "@/lib/privacy-policy";
import { SUPPORT_EMAIL } from "@/lib/schools";
import { APP_NAME } from "@/lib/utils";

export default function PrivacyPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <PageHeader
        title="Student Privacy Notice"
        description={`Effective ${PRIVACY_NOTICE_EFFECTIVE_DATE} · How ${APP_NAME} collects, uses, protects, and deletes information.`}
      />

      <div className="space-y-6 text-sm leading-7 text-muted-foreground">
        <NoticeSection title="Scope and responsibility">
          <p>
            StormHub is a school-community platform for clubs, events, opportunities, and club
            coursework. When a school authorizes StormHub, the school controls its educational
            use and determines who may participate. StormHub operates the application and
            processes information only to provide, secure, support, and improve that school use.
          </p>
          <p>
            This notice applies to StormHub accounts, school workspaces, support forms, email
            delivery, and optional Google Drive connections. Logged-out visitors see fictional
            demonstration content rather than real school records.
          </p>
        </NoticeSection>

        <NoticeSection title="Information we collect">
          <ul className="list-disc space-y-1 pl-5">
            <li>Account information: name, verified email, selected school, optional grade, role, account status, and profile image.</li>
            <li>School participation: club membership and leadership, RSVPs, attendance, opportunity signups, bookmarks, and notification preferences.</li>
            <li>Club coursework: assignments, submission status, written responses, links, uploaded files, selected Google Drive files, private feedback, and club coursework grades.</li>
            <li>Communications: contact-form name, reply email, message, category, administrative response, and enabled notification-email content.</li>
            <li>Operations and security: authentication/session information, hashed signup and request identifiers, CAPTCHA results, access timestamps, administrative audit events, errors, and support-access records.</li>
            <li>Product analytics: identifiable event type, time, school, account, related item, and limited technical metadata used for adoption, reliability, and school-scoped statistics.</li>
            <li>Google Drive, when connected: encrypted access and refresh tokens, token expiration, Google account email, selected file identifiers, names, types, and links.</li>
            <li>Account rights: export requests, deletion reasons, review status, reviewer notes, and completion dates.</li>
          </ul>
          <p>
            StormHub does not request official transcripts, report-card grades, disciplinary
            records, precise location, private student-to-student messages, advertising profiles,
            or payment-card information.
          </p>
        </NoticeSection>

        <NoticeSection title="How information is used">
          <ul className="list-disc space-y-1 pl-5">
            <li>Create and secure a school-scoped account.</li>
            <li>Operate clubs, events, opportunities, assignments, submissions, feedback, attendance, and notifications.</li>
            <li>Show school-authorized administrators participation and adoption statistics within their scope.</li>
            <li>Prevent abuse, investigate errors, provide support, keep audit records, and meet school or legal requirements.</li>
            <li>Improve reliability and usability without selling student information or using it for targeted advertising.</li>
          </ul>
        </NoticeSection>

        <NoticeSection title="Who can see information">
          <ul className="list-disc space-y-1 pl-5">
            <li>Students see their own account, participation, submissions, grades, and private feedback.</li>
            <li>Ordinary club members see peer first names and last initials with club roles. They do not see peer emails, grades, submissions, attendance records, or private feedback.</li>
            <li>Authorized club roster managers, Advisors, and scoped school administrators may see full roster names when needed for the school activity.</li>
            <li>Club Advisors and scoped school administrators may review and grade private coursework. Student leaders can track completion status but cannot open private submissions or grades.</li>
            <li>Platform administrators can manage ordinary workspace configuration without private coursework access. A platform administrator may open temporary read-only support access for one school after entering a reason. The session expires within 60 minutes, is logged, and notifies that school&apos;s administrators.</li>
          </ul>
          <p>
            Roles never authorize access outside their stated school or club scope. StormHub
            does not publish a searchable public student directory.
          </p>
        </NoticeSection>

        <NoticeSection title="School access and account verification">
          <p>
            Every new account must verify its email and enter the current private access code for
            the selected school. A school may accept its official email domain or allow other
            verified email domains, but the school code is required in either case. Administrators
            can rotate a compromised code without affecting existing accounts. Staff and
            administrative roles are assigned only by authorized administrators.
          </p>
        </NoticeSection>

        <NoticeSection title="Service providers and disclosures">
          <p>
            StormHub uses service providers only to operate the application: Supabase for
            authentication, database, and private file storage; Vercel for application hosting and
            scheduled retention; Resend for enabled email delivery; hCaptcha for abuse prevention;
            and Google only when a user chooses Google sign-in or connects Drive. hCaptcha and
            hosting providers may process network, browser, device, and request information needed
            to secure and deliver their services.
          </p>
          <p>
            Information may also be disclosed when directed by the authorizing school, required
            by law or valid legal process, or necessary to protect users and the service. StormHub
            does not sell or rent student information and does not disclose it for behavioral or
            targeted advertising.
          </p>
        </NoticeSection>

        <NoticeSection title="Google Drive and external files">
          <p>
            Drive is optional. StormHub requests the limited <code>drive.file</code> permission,
            which covers files selected or created through StormHub rather than a user&apos;s entire
            Drive. Tokens are encrypted at rest and removed when Drive is disconnected or the
            account is deleted. Google may retain files in the user&apos;s Drive until the user or
            school deletes them there. External links are governed by the destination service.
          </p>
        </NoticeSection>

        <NoticeSection title="Artificial intelligence">
          <p>
            External AI processing is disabled for the pilot. StormHub does not send student
            prompts, school records, submissions, or account information to an AI provider. Any
            future AI feature requires separate school approval and an updated notice before it is
            enabled.
          </p>
        </NoticeSection>

        <NoticeSection title="Retention and deletion">
          <p>
            The following pilot defaults are enforced for transient operational information.
            School record requirements, a security investigation, or a valid legal hold may
            require limited information to be preserved longer. Aggregate statistics that no
            longer identify a person may be retained.
          </p>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-muted/60 text-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Information</th>
                  <th className="px-4 py-3 font-semibold">Period</th>
                  <th className="px-4 py-3 font-semibold">What happens</th>
                </tr>
              </thead>
              <tbody>
                {RETENTION_SCHEDULE.map((item) => (
                  <tr key={item.data} className="border-t align-top">
                    <td className="px-4 py-3 font-medium text-foreground">{item.data}</td>
                    <td className="px-4 py-3">{item.period}</td>
                    <td className="px-4 py-3">{item.handling}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            A daily automated task removes expired operational records. Deactivated accounts and
            school-authored educational records are reviewed before permanent deletion so the
            system does not destroy information the school is required to preserve.
          </p>
        </NoticeSection>

        <NoticeSection title="Student and school rights">
          <ul className="list-disc space-y-1 pl-5">
            <li>Users can correct their profile information in Settings.</li>
            <li>Users can download a JSON export of the account information associated with them.</li>
            <li>Users can submit a permanent deletion request from Settings. Authorized administrators review requests to prevent accidental loss and required-record deletion.</li>
            <li>Schools may request access, correction, export, restriction, or deletion of student information under their control.</li>
            <li>Parents or eligible students should use the school&apos;s established FERPA record-review process for education-record requests.</li>
            <li>Google Drive can be disconnected at any time from Settings.</li>
          </ul>
        </NoticeSection>

        <NoticeSection title="Students and school-authorized use">
          <p>
            StormHub is intended for school-authorized educational and extracurricular use.
            Schools decide which grade levels may participate and provide any notice or consent
            required for their students. StormHub uses student information only for the school
            purpose described here and not for an unrelated commercial purpose.
          </p>
        </NoticeSection>

        <NoticeSection title="Security and incidents">
          <p>
            Protections include verified email, school access codes, scoped roles, row-level
            database security, private file storage, short-lived download links, encrypted Drive
            tokens, request throttling, CAPTCHA, protected service credentials, administrative
            audit records, and automatic retention. No online service can promise absolute
            security. Suspected unauthorized access should be reported immediately so StormHub
            and the affected school can investigate and provide any required notice.
          </p>
        </NoticeSection>

        <NoticeSection title="Questions, requests, and changes">
          <p>
            Contact{" "}
            <a className="text-storm-electric hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>{" "}
            or use the <Link className="text-storm-electric hover:underline" href="/contact">contact form</Link>.
            For school-record questions, also contact the applicable school administrator.
          </p>
          <p>
            Material changes will be posted on this page with a new effective date. When a change
            meaningfully affects school-controlled student information, StormHub will seek school
            approval before applying it to that school&apos;s use.
          </p>
        </NoticeSection>
      </div>
    </div>
  );
}

function NoticeSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}
