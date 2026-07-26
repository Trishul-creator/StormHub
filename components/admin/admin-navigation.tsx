"use client";

import {
  BarChart3,
  Building2,
  FileCheck2,
  History,
  Inbox,
  LayoutDashboard,
  ShieldCheck,
  UserRoundX,
  Users,
} from "lucide-react";
import { WorkspaceNavigation, type WorkspaceNavigationLink } from "@/components/layout/workspace-navigation";

interface AdminNavigationProps {
  isSuperAdmin: boolean;
}

const sharedLinks = [
  { href: "/admin/statistics", label: "Statistics", icon: BarChart3 },
  { href: "/admin/users", label: "Users & roles", icon: Users },
  { href: "/admin/content", label: "Moderation", icon: FileCheck2 },
  { href: "/admin/deletion-requests", label: "Deletion requests", icon: UserRoundX },
  { href: "/admin/audit", label: "Audit log", icon: History },
];

export function AdminNavigation({ isSuperAdmin }: AdminNavigationProps) {
  const links: WorkspaceNavigationLink[] = [
    isSuperAdmin
      ? { href: "/admin/schools", label: "Schools", icon: Building2 }
      : { href: "/admin", label: "Overview", icon: LayoutDashboard },
    ...sharedLinks.slice(0, 3),
    ...(isSuperAdmin ? [{ href: "/admin/feedback", label: "Support inbox", icon: Inbox }] : []),
    ...sharedLinks.slice(3),
  ];

  return (
    <WorkspaceNavigation
      ariaLabel="Administration"
      eyebrow={isSuperAdmin ? "Platform" : "School"}
      title="Administration"
      icon={ShieldCheck}
      links={links}
    />
  );
}
