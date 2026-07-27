import { CheckCircle2 } from "lucide-react";
import { CLUB_ROLE_DEFINITIONS } from "@/lib/club-roles";

export function ClubRoleGuide() {
  return (
    <section className="mb-6">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-storm-navy">Club roles and permissions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Leadership tools are additional permissions. Presidents and Vice Presidents remain
          students and complete graded assignments alongside Members.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {CLUB_ROLE_DEFINITIONS.map((role) => (
          <article key={role.key} className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="font-semibold text-storm-navy">{role.label}</p>
            <p className="mt-1 text-xs font-medium text-storm-electric">{role.counterpart}</p>
            <p className="mt-2 text-sm text-muted-foreground">{role.summary}</p>
            <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
              {role.capabilities.map((capability) => (
                <li key={capability} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <span>{capability}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
