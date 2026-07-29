import {
  Activity,
  CalendarDays,
  CheckCircle2,
  CircleUserRound,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { AdminStatistics, ClubStatus, UserRole } from "@/types/database";

const roleLabels: Record<UserRole, string> = {
  student: "Students",
  teacher: "Teachers",
  admin: "School admins",
  district_admin: "District admins",
  super_admin: "Platform admins",
};

const statusLabels: Record<ClubStatus, string> = {
  active: "Active",
  interest_open: "Interest open",
  draft: "Draft",
  paused: "Paused",
  archived: "Archived",
};

const statusColors: Record<ClubStatus, string> = {
  active: "bg-emerald-500",
  interest_open: "bg-blue-500",
  draft: "bg-amber-400",
  paused: "bg-slate-400",
  archived: "bg-slate-700",
};

export function StatisticsDashboard({ statistics }: { statistics: AdminStatistics }) {
  const engagementRate = percentage(statistics.engagedPeople30d, statistics.activePeople);
  const activeClubRate = percentage(statistics.activeClubs, statistics.totalClubs);

  return (
    <div className="space-y-6">
      <section aria-labelledby="statistics-overview" className="motion-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <h2 id="statistics-overview" className="sr-only">Statistics overview</h2>
        <MetricCard
          label="People"
          value={statistics.totalPeople}
          detail={`${statistics.activePeople} active accounts`}
          icon={CircleUserRound}
          tone="blue"
        />
        <MetricCard
          label="Engaged in 30 days"
          value={statistics.engagedPeople30d}
          detail={`${engagementRate}% of active accounts`}
          icon={Activity}
          tone="violet"
        />
        <MetricCard
          label="Active clubs"
          value={statistics.activeClubs}
          detail={`${activeClubRate}% of ${statistics.totalClubs} clubs`}
          icon={CheckCircle2}
          tone="emerald"
        />
        <MetricCard
          label="Club memberships"
          value={statistics.activeMemberships}
          detail="Active student memberships"
          icon={UsersRound}
          tone="amber"
        />
        <MetricCard
          label="Upcoming events"
          value={statistics.upcomingEvents}
          detail="Approved future events"
          icon={CalendarDays}
          tone="cyan"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
        <section className="motion-block overflow-hidden rounded-2xl border bg-card shadow-sm" aria-labelledby="activity-chart-title">
          <div className="border-b px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 id="activity-chart-title" className="text-lg font-semibold text-storm-navy">Six-month activity</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Account growth, club joins, and tracked actions by month.
                </p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-hidden="true">
                <LegendDot color="bg-blue-600" label="New people" />
                <LegendDot color="bg-emerald-600" label="Club joins" />
                <LegendDot color="bg-violet-600" label="Tracked actions" />
              </div>
            </div>
          </div>
          <p className="px-5 pt-3 text-xs font-medium text-muted-foreground sm:hidden">
            Swipe the chart to see all six months →
          </p>
          <div
            className="overflow-x-auto px-3 py-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 sm:px-6"
            role="region"
            aria-label="Six-month activity chart"
            tabIndex={0}
          >
            <ActivityLineChart data={statistics.monthlyActivity} />
          </div>
        </section>

        <section className="motion-block rounded-2xl border bg-card p-5 shadow-sm sm:p-6" aria-labelledby="people-breakdown-title">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="people-breakdown-title" className="text-lg font-semibold text-storm-navy">People by role</h2>
              <p className="mt-1 text-sm text-muted-foreground">Accounts inside the selected scope.</p>
            </div>
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700">
              <UsersRound className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-6 space-y-5">
            {statistics.roleDistribution
              .filter((item) => item.count > 0)
              .map((item) => (
                <HorizontalBar
                  key={item.role}
                  label={roleLabels[item.role]}
                  value={item.count}
                  maximum={Math.max(...statistics.roleDistribution.map((role) => role.count), 1)}
                  color={item.role === "student" ? "bg-blue-600" : item.role === "teacher" ? "bg-violet-600" : "bg-slate-700"}
                />
              ))}
          </div>
          <div className="mt-6 rounded-xl bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
            <span className="font-semibold text-storm-navy">{statistics.newPeople30d}</span> new accounts were created in the last 30 days.
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="motion-block rounded-2xl border bg-card p-5 shadow-sm sm:p-6" aria-labelledby="club-status-title">
          <div>
            <h2 id="club-status-title" className="text-lg font-semibold text-storm-navy">Club status</h2>
            <p className="mt-1 text-sm text-muted-foreground">Where every club currently sits.</p>
          </div>
          <div className="mt-6 flex h-3 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            {statistics.clubStatusDistribution.map((item) => (
              item.count > 0 && (
                <div
                  key={item.status}
                  className={cn(statusColors[item.status], "min-w-1")}
                  style={{ width: `${percentage(item.count, statistics.totalClubs)}%` }}
                />
              )
            ))}
          </div>
          <div className="mt-5 space-y-3">
            {statistics.clubStatusDistribution.map((item) => (
              <div key={item.status} className="flex items-center justify-between gap-4 text-sm">
                <div className="flex items-center gap-2.5">
                  <span className={cn("h-2.5 w-2.5 rounded-full", statusColors[item.status])} aria-hidden="true" />
                  <span className="text-slate-700">{statusLabels[item.status]}</span>
                </div>
                <span className="font-semibold tabular-nums text-storm-navy">{item.count}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="motion-block rounded-2xl border bg-card p-5 shadow-sm sm:p-6" aria-labelledby="active-clubs-title">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 id="active-clubs-title" className="text-lg font-semibold text-storm-navy">Most active clubs</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Ranked by active members, recent events, and tracked club activity.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <TrendingUp className="h-4 w-4" />
              Last 30 days
            </div>
          </div>
          {statistics.topClubs.length ? (
            <div className="mt-6 space-y-5">
              {statistics.topClubs.map((club, index) => (
                <div key={club.id}>
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-storm-navy">
                        <span className="mr-2 text-xs text-muted-foreground">{index + 1}</span>
                        {club.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {club.members} members · {club.recentEvents} recent events
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      {statusLabels[club.status]}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 to-violet-500"
                      style={{
                        width: `${percentage(
                          club.score,
                          Math.max(...statistics.topClubs.map((item) => item.score), 1),
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              Active clubs will appear here as participation is recorded.
            </div>
          )}
        </section>
      </div>

      <section className="motion-block rounded-2xl border border-blue-100 bg-blue-50/70 px-5 py-4 text-sm text-blue-950 dark:border-blue-900/70 dark:bg-blue-950/40 dark:text-blue-100">
        <p className="font-semibold">How “engaged” is calculated</p>
        <p className="mt-1 text-blue-900/80 dark:text-blue-200/75">
          A person counts once when they join a club, RSVP, save an item, submit coursework, or perform another tracked action during the last 30 days. Statistics are aggregated and do not expose individual activity.
        </p>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  icon: typeof Activity;
  tone: "blue" | "violet" | "emerald" | "amber" | "cyan";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    violet: "bg-violet-50 text-violet-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    cyan: "bg-cyan-50 text-cyan-700",
  };

  return (
    <div className="interactive-card rounded-2xl border bg-card p-5 shadow-sm hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none">
      <div className={cn("mb-4 flex h-10 w-10 items-center justify-center rounded-xl", tones[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-3xl font-bold tracking-tight text-storm-navy tabular-nums">{value.toLocaleString()}</p>
      <p className="mt-1 text-sm font-medium text-slate-700">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", color)} />
      {label}
    </span>
  );
}

function HorizontalBar({
  label,
  value,
  maximum,
  color,
}: {
  label: string;
  value: number;
  maximum: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4 text-sm">
        <span className="text-slate-700">{label}</span>
        <span className="font-semibold tabular-nums text-storm-navy">{value.toLocaleString()}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${percentage(value, maximum)}%` }} />
      </div>
    </div>
  );
}

function ActivityLineChart({ data }: { data: AdminStatistics["monthlyActivity"] }) {
  const width = 680;
  const height = 250;
  const padding = { top: 18, right: 18, bottom: 42, left: 44 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maximum = Math.max(
    ...data.flatMap((item) => [item.newPeople, item.newMemberships, item.engagementEvents]),
    1,
  );
  const roundedMaximum = Math.max(10, Math.ceil(maximum / 10) * 10);
  const series = [
    { key: "newPeople" as const, label: "New people", color: "#2563EB" },
    { key: "newMemberships" as const, label: "Club joins", color: "#059669" },
    { key: "engagementEvents" as const, label: "Tracked actions", color: "#7C3AED" },
  ];
  const xFor = (index: number) => padding.left + (data.length === 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
  const yFor = (value: number) => padding.top + plotHeight - (value / roundedMaximum) * plotHeight;

  return (
    <>
      <svg
        className="min-w-[560px] text-muted-foreground"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby="activity-chart-svg-title activity-chart-svg-description"
      >
        <title id="activity-chart-svg-title">Six-month activity line graph</title>
        <desc id="activity-chart-svg-description">
          Compares new people, new club memberships, and tracked actions for each of the last six months.
        </desc>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + plotHeight - (ratio * plotHeight);
          return (
            <g key={ratio}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="#E2E8F0"
                strokeDasharray={ratio === 0 ? undefined : "4 5"}
              />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#64748B">
                {Math.round(roundedMaximum * ratio)}
              </text>
            </g>
          );
        })}
        {data.map((item, index) => (
          <text
            key={item.month}
            x={xFor(index)}
            y={height - 14}
            textAnchor="middle"
            fontSize="11"
            fill="#64748B"
          >
            {formatMonth(item.month)}
          </text>
        ))}
        {series.map((item) => {
          const points = data.map((row, index) => `${xFor(index)},${yFor(row[item.key])}`).join(" ");
          return (
            <g key={item.key}>
              <polyline
                points={points}
                fill="none"
                stroke={item.color}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {data.map((row, index) => (
                <circle
                  key={`${item.key}-${row.month}`}
                  cx={xFor(index)}
                  cy={yFor(row[item.key])}
                  r="4"
                  fill="white"
                  stroke={item.color}
                  strokeWidth="2.5"
                />
              ))}
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>Six-month activity data</caption>
        <thead>
          <tr>
            <th>Month</th>
            <th>New people</th>
            <th>Club joins</th>
            <th>Tracked actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.month}>
              <th>{formatMonth(item.month)}</th>
              <td>{item.newPeople}</td>
              <td>{item.newMemberships}</td>
              <td>{item.engagementEvents}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function percentage(value: number, total: number): number {
  if (value <= 0 || total <= 0) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}

function formatMonth(value: string): string {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1)));
}
