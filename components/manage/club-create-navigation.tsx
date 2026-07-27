import Link from "next/link";
import { Calendar, ClipboardList, FileText, Megaphone } from "lucide-react";
import { cn } from "@/lib/cn";

type CreateType = "announcement" | "assignment" | "event" | "resource";

const createOptions = [
  {
    type: "announcement" as const,
    label: "Announcement",
    description: "Share an update with every club member.",
    path: "announcements",
    icon: Megaphone,
  },
  {
    type: "assignment" as const,
    label: "Assignment",
    description: "Collect work, return feedback, and grade.",
    path: "coursework",
    icon: ClipboardList,
  },
  {
    type: "event" as const,
    label: "Event",
    description: "Add a meeting or deadline to the calendar.",
    path: "events",
    icon: Calendar,
  },
  {
    type: "resource" as const,
    label: "Material",
    description: "Post a reusable link, guide, or reference.",
    path: "resources",
    icon: FileText,
  },
];

export function ClubCreateNavigation({
  clubSlug,
  activeType,
  courseworkEnabled = true,
}: {
  clubSlug: string;
  activeType: CreateType;
  courseworkEnabled?: boolean;
}) {
  const options = courseworkEnabled
    ? createOptions
    : createOptions.filter((option) => option.type !== "assignment");
  const activeOption = options.find((option) => option.type === activeType) ?? options[0];

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="border-b bg-storm-light/20 p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-storm-electric">
          Create for your club
        </p>
        <nav aria-label="Choose what to create" className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {options.map(({ type, label, path, icon: Icon }) => (
            <Link
              key={type}
              href={`/manage/clubs/${clubSlug}/${path}`}
              aria-current={activeType === type ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-[background-color,border-color,color,transform] duration-200",
                activeType === type
                  ? "border-storm-navy bg-storm-navy text-white shadow-sm"
                  : "border-transparent bg-card text-storm-navy hover:border-storm-electric/20 hover:text-storm-electric"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="px-5 py-4">
        <h2 className="font-semibold text-storm-navy">{activeOption.label}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{activeOption.description}</p>
      </div>
    </section>
  );
}
