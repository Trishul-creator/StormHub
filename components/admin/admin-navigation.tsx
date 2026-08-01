"use client";

import {
  Activity,
  ArchiveX,
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
import type { UserRole } from "@/types/database";

interface AdminNavigationProps {
  role: UserRole;
}

const sharedLinks = [
  { href: "/admin/statistics", label: "Statistics", icon: BarChart3 },
  { href: "/admin/users", label: "Users & roles", icon: Users },
  { href: "/admin/content", label: "Moderation", icon: FileCheck2 },
  { href: "/admin/deletion-requests", label: "Deletion requests", icon: UserRoundX },
  { href: "/admin/audit", label: "Audit log", icon: History },
];

export function AdminNavigation({ role }: AdminNavigationProps) {
  const isSuperAdmin = role === "super_admin";
  const isDistrictAdmin = role === "district_admin";
  const links: WorkspaceNavigationLink[] = [
    isSuperAdmin
      ? { href: "/admin/districts", label: "Districts", icon: Building2 }
      : isDistrictAdmin
        ? { href: "/admin/districts", label: "District", icon: Building2 }
      : { href: "/admin", label: "Overview", icon: LayoutDashboard },
    ...sharedLinks.slice(0, 2),
    ...(!isDistrictAdmin ? [sharedLinks[2]] : []),
    { href: "/admin/feedback", label: "Support inbox", icon: Inbox },
    { href: "/admin/offboarding", label: "Tenant offboarding", icon: ArchiveX },
    ...sharedLinks.slice(3),
    ...(isSuperAdmin
      ? [{ href: "/admin/system-health", label: "System health", icon: Activity }]
      : []),
  ];

  return (
    <WorkspaceNavigation
      ariaLabel="Administration"
      eyebrow={isSuperAdmin ? "Platform" : isDistrictAdmin ? "District" : "School"}
      title="Administration"
      icon={ShieldCheck}
      links={links}
      tourId="admin-tools"
    />
  );
}
