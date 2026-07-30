import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { POLICY_EFFECTIVE_DATE } from "@/lib/policy";
import { SUPPORT_EMAIL } from "@/lib/schools";

const rules = [
  {
    title: "Use StormHub for school purposes",
    body: "Use the platform for authorized clubs, events, opportunities, coursework, communication, and related school activities. Follow applicable school policies and staff instructions.",
  },
  {
    title: "Protect accounts and school access",
    body: "Do not share passwords, authentication links, or a school access code outside the intended school community. Report a publicly posted or compromised code to an administrator.",
  },
  {
    title: "Respect privacy",
    body: "Do not copy, publish, scrape, or redistribute student names, attendance, submissions, grades, contact details, or other school information without authorization. Do not ask other users for unnecessary personal information.",
  },
  {
    title: "Treat people respectfully",
    body: "Do not harass, threaten, impersonate, discriminate against, or embarrass another person. Club posts, assignment responses, links, filenames, and uploaded material must be appropriate for school.",
  },
  {
    title: "Keep the service secure",
    body: "Do not bypass access controls, probe other accounts or schools, upload malware, automate abusive requests, interfere with availability, or use information obtained through an error. Report security problems instead of exploiting them.",
  },
  {
    title: "Upload only authorized material",
    body: "Submit files and links that you are permitted to use and that relate to the school activity. Do not upload illegal material, executable code, sensitive personal records, or content that violates another person's rights.",
  },
] as const;

export default function AcceptableUsePage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <PageHeader
        title="Acceptable Use Policy"
        description={`Effective ${POLICY_EFFECTIVE_DATE} · The rules that keep StormHub safe, school-appropriate, and useful.`}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {rules.map((rule) => (
          <Card key={rule.title}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{rule.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-7 text-muted-foreground">
              {rule.body}
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Enforcement and reporting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
          <p>
            Content may be removed and accounts may be limited, suspended, or deleted when needed
            to protect users, comply with school direction, investigate misuse, or enforce this
            policy. Serious matters may be referred to the school.
          </p>
          <p>
            Report unsafe behavior, accidental disclosure, or security concerns to{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-storm-electric hover:underline">
              {SUPPORT_EMAIL}
            </a>{" "}
            and the appropriate school administrator.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
