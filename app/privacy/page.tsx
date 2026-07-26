import { PageHeader } from "@/components/layout/page-header";
import { APP_NAME } from "@/lib/utils";

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <PageHeader title="Privacy" description={`How ${APP_NAME} protects your information.`} />

      <div className="motion-stagger space-y-6 text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-storm-navy mb-2">What we collect</h2>
          <p>StormHub collects only what is needed for club participation and opportunity discovery:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Name and school email (for account creation)</li>
            <li>Grade level (optional)</li>
            <li>Club memberships and event RSVPs</li>
            <li>Saved opportunities and club participation</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-storm-navy mb-2">Service providers</h2>
          <p>
            StormHub uses Supabase for accounts and database hosting, Vercel for application hosting,
            Resend for enabled email delivery, and hCaptcha for abuse prevention. These providers process
            only the information needed to operate those services under the school&apos;s approved configuration.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-storm-navy mb-2">Optional assistant</h2>
          <p>
            The assistant is disabled unless the district approves external AI processing. When enabled,
            user prompts, the user&apos;s role, the school name, and public club or opportunity listings are sent
            to the approved AI provider. Names, email addresses, memberships, saved items, notifications, and
            approval records are not included in the provider context.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-storm-navy mb-2">What we do NOT collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Grades or academic records</li>
            <li>Disciplinary records</li>
            <li>Private messages between students</li>
            <li>Public student profiles by default</li>
            <li>Location tracking or targeted advertising data</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-storm-navy mb-2">How we use data</h2>
          <p>
            Your data is used solely to provide club enrollment, event RSVPs, opportunity bookmarks,
            and basic analytics (club join counts, event attendance). We do not sell student data.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-storm-navy mb-2">Your rights</h2>
          <p>
            You can export your account data or submit a permanent deletion request from Settings. An authorized
            administrator reviews deletion requests to prevent accidental loss and complete required record checks.
            Operational audit records may be retained after account deletion when required for security and
            accountability.
          </p>
        </section>

        <section className="rounded-xl border p-5">
          <p className="text-sm">
            StormHub is designed to collect only what is needed for club participation and opportunity discovery.
            It does not store grades, disciplinary records, private messages, or sensitive student information.
          </p>
        </section>
      </div>
    </div>
  );
}
