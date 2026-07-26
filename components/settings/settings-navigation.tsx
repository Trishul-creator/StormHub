"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, ChevronRight, Shield, User } from "lucide-react";
import { cn } from "@/lib/cn";

const settingsSections = [
  {
    id: "profile",
    label: "Profile",
    description: "Personal details",
    icon: User,
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Updates and email",
    icon: Bell,
  },
  {
    id: "account",
    label: "Account & privacy",
    description: "Data and deletion",
    icon: Shield,
  },
] as const;

export function SettingsNavigation() {
  const [activeSection, setActiveSection] = useState<(typeof settingsSections)[number]["id"]>("profile");

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleSection = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];

        if (visibleSection) {
          setActiveSection(visibleSection.target.id as (typeof settingsSections)[number]["id"]);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );

    settingsSections.forEach(({ id }) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <aside className="min-w-0 max-w-full lg:sticky lg:top-24 lg:self-start">
      <div className="max-w-full overflow-hidden rounded-2xl border bg-white/85 p-2 shadow-sm backdrop-blur">
        <div className="hidden border-b px-3 pb-4 pt-2 lg:block">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-storm-electric">
            Your preferences
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a section to review.
          </p>
        </div>
        <nav
          aria-label="Settings sections"
          className="flex w-full max-w-full gap-2 overflow-x-auto p-1 lg:mt-2 lg:flex-col lg:overflow-visible"
        >
          {settingsSections.map(({ id, label, description, icon: Icon }) => {
            const isActive = activeSection === id;

            return (
              <Link
                key={id}
                href={`#${id}`}
                aria-current={isActive ? "location" : undefined}
                onClick={() => setActiveSection(id)}
                className={cn(
                  "group flex min-w-fit items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-[background-color,color,transform] duration-200 lg:w-full",
                  isActive
                    ? "bg-storm-navy text-white shadow-sm"
                    : "text-storm-navy hover:bg-storm-light/55 hover:text-storm-electric"
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                    isActive ? "bg-white/15 text-white" : "bg-storm-light/60 text-storm-blue group-hover:bg-white"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className={cn("hidden text-xs lg:block", isActive ? "text-white/70" : "text-muted-foreground")}>
                    {description}
                  </span>
                </span>
                <ChevronRight
                  className={cn(
                    "ml-auto hidden h-4 w-4 transition-transform lg:block",
                    isActive ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-60"
                  )}
                />
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
