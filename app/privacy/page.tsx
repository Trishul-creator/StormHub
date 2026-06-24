import { PageHeader } from "@/components/layout/page-header";
import { APP_NAME } from "@/lib/utils";

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <PageHeader title="Privacy" description={`How ${APP_NAME} protects your information.`} />

      <div className="space-y-6 text-muted-foreground leading-relaxed">
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
            You can request deletion of your account and associated data. Contact us through the
            feedback form or reach out to a platform administrator.
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
