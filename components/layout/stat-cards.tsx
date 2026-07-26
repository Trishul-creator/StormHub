import Link from "next/link";
import { Users, Calendar, Briefcase, UserCheck } from "lucide-react";

interface StatCardsProps {
  clubsCount: number;
  eventsCount: number;
  opportunitiesCount: number;
  studentsJoined: number;
}

export function StatCards({ clubsCount, eventsCount, opportunitiesCount, studentsJoined }: StatCardsProps) {
  const stats = [
    { label: "Clubs listed", value: clubsCount, icon: Users },
    { label: "Upcoming events", value: eventsCount, icon: Calendar },
    { label: "Opportunities posted", value: opportunitiesCount, icon: Briefcase },
    { label: "Students joined", value: studentsJoined, icon: UserCheck },
  ];

  return (
    <div className="motion-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="interactive-card rounded-xl bg-white/10 p-6 text-center backdrop-blur hover:bg-white/15 hover:shadow-lg motion-safe:hover:-translate-y-1 motion-reduce:transform-none">
          <s.icon className="mx-auto mb-2 h-6 w-6 text-storm-electric" />
          <div className="text-3xl font-bold text-white">{s.value}</div>
          <div className="text-sm text-storm-silver">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

export function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      {Icon && <Icon className="mb-2 h-5 w-5 text-storm-electric" />}
      <div className="text-2xl font-bold text-storm-navy">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

export function DashboardCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-storm-navy">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}
