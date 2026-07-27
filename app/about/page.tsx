import { PageHeader } from "@/components/layout/page-header";
import { Shield, Users, Zap, Heart } from "lucide-react";
import { APP_NAME } from "@/lib/utils";
import { getCurrentSchool } from "@/lib/schools";

export default async function AboutPage() {
  const school = await getCurrentSchool();
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <PageHeader
        title={`About ${APP_NAME}`}
        description="A student-built opportunity hub designed to help students find their next step."
      />

      <div className="prose prose-storm max-w-none space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-storm-navy">Our mission</h2>
          <p className="text-muted-foreground leading-relaxed mt-2">
            {APP_NAME} brings clubs, scheduled events, applications, tryouts, auditions, and deadlines into one clean place.
            Built for {school?.name ?? "school"} students, Advisors, and club leaders — designed to help students discover opportunities
            that could shape their high school experience.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {[
            { icon: Shield, title: "Privacy-first", desc: "No grades, no sensitive data, no private DMs. Minimal data collection." },
            { icon: Users, title: "Student-focused", desc: "Simple browsing, one-click club enrollment, member-only resources." },
            { icon: Zap, title: "Opportunity-driven", desc: "Competitions, tutoring, research, music auditions — all in one hub." },
            { icon: Heart, title: "School-safe", desc: "Built with school administration approval in mind." },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border p-5">
              <item.icon className="h-6 w-6 text-storm-electric mb-2" />
              <h3 className="font-semibold text-storm-navy">{item.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{item.desc}</p>
            </div>
          ))}
        </section>

        <section className="rounded-xl bg-storm-light/30 p-6">
          <p className="text-sm text-muted-foreground">
            <strong className="text-storm-navy">Disclaimer:</strong> StormHub is a student-built platform.
            It is not an official school system unless approved by school administration.
            Always verify important dates and requirements with club Advisors and school staff.
          </p>
        </section>
      </div>
    </div>
  );
}
