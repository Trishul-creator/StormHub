import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PRIVACY_NOTICE_EFFECTIVE_DATE } from "@/lib/privacy-policy";
import { SUPPORT_EMAIL } from "@/lib/schools";

export default function TermsPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <PageHeader
        title="Terms of Use"
        description={`Effective ${PRIVACY_NOTICE_EFFECTIVE_DATE} · Terms for school-authorized StormHub use.`}
      />
      <div className="space-y-4 text-sm leading-7 text-muted-foreground">
        <TermsSection title="School-authorized service">
          StormHub provides tools for school clubs, events, opportunities, participation, and club
          coursework. A listed workspace is not represented as an official school system unless
          the applicable school has authorized it. The school may establish additional rules and
          may direct account or content changes within its workspace.
        </TermsSection>
        <TermsSection title="Accounts and roles">
          Provide accurate account information, use only the school workspace you are authorized
          to join, protect your credentials, and promptly report unauthorized access. Students
          cannot assign themselves staff or administrative roles. Permissions depend on both the
          account role and the applicable school or club scope.
        </TermsSection>
        <TermsSection title="Content and coursework">
          Users retain responsibility for material they submit and grant StormHub and the
          authorizing school permission to store, display, copy, and process it as necessary to
          provide the school activity. Club coursework scores are not official report-card grades
          unless the school separately adopts them for that purpose.
        </TermsSection>
        <TermsSection title="Google and external services">
          Google Drive and external links are optional and subject to their providers&apos; terms.
          Users must have permission to share selected files. Disconnecting Drive removes
          StormHub&apos;s stored connection but does not automatically delete files from Google.
        </TermsSection>
        <TermsSection title="Availability and changes">
          StormHub may change, suspend, or discontinue features for security, maintenance, school
          direction, or pilot development. Reasonable care is used, but uninterrupted operation
          and preservation of user-provided external links cannot be guaranteed. Important
          information should not exist only in StormHub when school policy requires another
          official record.
        </TermsSection>
        <TermsSection title="Suspension and termination">
          StormHub or an authorized school administrator may limit or terminate an account for
          policy violations, security risks, departure from the school, or school instruction.
          Users may request account deletion through Settings, subject to school record
          requirements described in the Privacy Notice.
        </TermsSection>
        <TermsSection title="Related policies and contact">
          Use is also governed by the{" "}
          <Link href="/acceptable-use" className="text-storm-electric hover:underline">
            Acceptable Use Policy
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-storm-electric hover:underline">
            Student Privacy Notice
          </Link>. Questions may be sent to{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-storm-electric hover:underline">
            {SUPPORT_EMAIL}
          </a>.
        </TermsSection>
      </div>
    </div>
  );
}

function TermsSection({
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
      <CardContent>{children}</CardContent>
    </Card>
  );
}
