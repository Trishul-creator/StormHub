"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface WorkspaceNavigationLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface WorkspaceNavigationProps {
  ariaLabel: string;
  eyebrow: string;
  title: string;
  icon: LucideIcon;
  links: WorkspaceNavigationLink[];
  sticky?: boolean;
}

export function WorkspaceNavigation({
  ariaLabel,
  eyebrow,
  title,
  icon: ScopeIcon,
  links,
  sticky = true,
}: WorkspaceNavigationProps) {
  const pathname = usePathname();
  const isActive = (href: string) => (
    href === "/admin" || href === "/manage"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`)
  );

  return (
    <div
      className={cn(
        "z-40 border-b border-border bg-card/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/85",
        sticky && "sticky top-16"
      )}
    >
      <div className="container mx-auto flex min-w-0 items-center gap-3 px-4">
        <div className="hidden shrink-0 items-center gap-2 border-r border-border pr-4 xl:flex">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-storm-gradient text-white shadow-sm">
            <ScopeIcon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-storm-electric">
              {eyebrow}
            </span>
            <span className="block text-xs text-muted-foreground">{title}</span>
          </span>
        </div>

        <nav
          aria-label={ariaLabel}
          className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {links.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);

            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex min-w-fit items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-[background-color,color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-storm-electric focus-visible:ring-offset-2 motion-reduce:transform-none",
                  active
                    ? "bg-storm-gradient text-white shadow-sm"
                    : "text-muted-foreground hover:-translate-y-0.5 hover:bg-storm-light/60 hover:text-storm-electric"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    active ? "text-blue-200" : "text-muted-foreground group-hover:text-storm-electric"
                  )}
                  aria-hidden="true"
                />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
