import Link from "next/link";
import { ClipboardList, LayoutList, Users } from "lucide-react";
import { cn } from "@/lib/cn";

type WorkspaceView = "stream" | "classwork" | "people";

export function ClubWorkspaceNav({
  clubSlug,
  activeView,
  assignmentCount,
  memberCount,
}: {
  clubSlug: string;
  activeView: WorkspaceView;
  assignmentCount: number;
  memberCount: number;
}) {
  const items = [
    { view: "stream" as const, label: "Stream", icon: LayoutList },
    { view: "classwork" as const, label: "Classwork", icon: ClipboardList, count: assignmentCount },
    { view: "people" as const, label: "People", icon: Users, count: memberCount },
  ];

  return (
    <nav aria-label="Club workspace" className="mb-8 overflow-x-auto border-b">
      <div className="flex min-w-max gap-1">
        {items.map(({ view, label, icon: Icon, count }) => (
          <Link
            key={view}
            href={`/clubs/${clubSlug}/member${view === "stream" ? "" : `?view=${view}`}`}
            aria-current={activeView === view ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-storm-electric",
              activeView === view
                ? "text-storm-electric after:scale-x-100"
                : "text-muted-foreground after:scale-x-0 hover:text-storm-navy"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {typeof count === "number" && (
              <span className="rounded-full bg-storm-light/70 px-2 py-0.5 text-[11px] text-storm-navy">
                {count}
              </span>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}
