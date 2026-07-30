import { ContactForm } from "@/components/forms/contact-form";
import { PageHeader } from "@/components/layout/page-header";
import { getAuthContext } from "@/lib/auth";
import { getSchoolById, getSignupSchools } from "@/lib/schools";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "stormhubsupport@gmail.com";

export default async function ContactPage() {
  const [auth, schools] = await Promise.all([
    getAuthContext(),
    getSignupSchools(),
  ]);
  const assignedSchool = auth.profile?.school_id
    ? await getSchoolById(auth.profile.school_id)
    : null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <PageHeader
        title="Contact & Feedback"
        description="Share feedback, report issues, or suggest improvements for StormHub."
      />
      <div className="mb-6 rounded-xl border border-storm-light bg-storm-light/30 p-4 text-sm text-muted-foreground">
        <p>
          Use the form below for a bug, account issue, or feedback. The message stays in StormHub
          for authorized review; support receives a generic alert without the message content.
        </p>
        <p className="mt-2">
          If you prefer direct email, contact{" "}
          <a className="font-medium text-storm-electric underline-offset-4 hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>. Direct email is processed by the configured mailbox provider, so prefer the form
          for student-specific details.
        </p>
      </div>
      <ContactForm
        assignedSchool={assignedSchool ? { id: assignedSchool.id, name: assignedSchool.name } : null}
        schools={schools.map((school) => ({ id: school.id, name: school.name }))}
      />
    </div>
  );
}
