"use client";

import { useState } from "react";
import { Calendar, ClipboardList, FileText, Megaphone } from "lucide-react";
import { ContentForm } from "@/components/forms/content-form";
import { AssignmentForm } from "@/components/coursework/assignment-form";
import { cn } from "@/lib/cn";

type ComposerType = "announcement" | "assignment" | "event" | "resource";

const composerOptions = [
  {
    type: "announcement" as const,
    label: "Announcement",
    description: "Share an update with every club member.",
    icon: Megaphone,
  },
  {
    type: "assignment" as const,
    label: "Assignment",
    description: "Collect work, return feedback, and grade.",
    icon: ClipboardList,
  },
  {
    type: "event" as const,
    label: "Event",
    description: "Add a meeting or deadline to the calendar.",
    icon: Calendar,
  },
  {
    type: "resource" as const,
    label: "Material",
    description: "Post a reusable link, guide, or reference.",
    icon: FileText,
  },
];

export function ClubPostComposer({
  clubSlug,
  defaultType = "announcement",
  courseworkEnabled = true,
}: {
  clubSlug: string;
  defaultType?: ComposerType;
  courseworkEnabled?: boolean;
}) {
  const [selectedType, setSelectedType] = useState<ComposerType>(defaultType);
  const availableOptions = courseworkEnabled
    ? composerOptions
    : composerOptions.filter((option) => option.type !== "assignment");
  const selected = availableOptions.find((option) => option.type === selectedType) ?? availableOptions[0];

  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="border-b bg-storm-light/20 p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-storm-electric">Create for your club</p>
        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {availableOptions.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              type="button"
              aria-pressed={selectedType === type}
              onClick={() => setSelectedType(type)}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-[background-color,border-color,color,transform] duration-200",
                selectedType === type
                  ? "border-storm-navy bg-storm-navy text-white shadow-sm"
                  : "border-transparent bg-white text-storm-navy hover:border-storm-electric/20 hover:text-storm-electric"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-b px-5 py-4">
        <h2 className="font-semibold text-storm-navy">{selected.label}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{selected.description}</p>
      </div>

      {selectedType === "assignment" ? (
        <AssignmentForm clubSlug={clubSlug} className="rounded-none border-0 shadow-none" />
      ) : (
        <ContentForm
          type={selectedType}
          clubSlug={clubSlug}
          className="rounded-none border-0 shadow-none"
        />
      )}
    </section>
  );
}
