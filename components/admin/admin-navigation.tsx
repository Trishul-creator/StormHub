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
  { href: "/admin/statistics", label: "Statistics", icon: BarChart3, tourId: "admin-statistics" },
  { href: "/admin/users", label: "Users & roles", icon: Users, tourId: "admin-users" },
  { href: "/admin/content", label: "Moderation", icon: FileCheck2, tourId: "admin-moderation" },
  { href: "/admin/deletion-requests", label: "Deletion requests", icon: UserRoundX, tourId: "admin-deletion" },
  { href: "/admin/audit", label: "Audit log", icon: History, tourId: "admin-audit" },
];

export function AdminNavigation({ role }: AdminNavigationProps) {
  const isSuperAdmin = role === "super_admin";
  const isDistrictAdmin = role === "district_admin";
  const links: WorkspaceNavigationLink[] = [
    isSuperAdmin
      ? { href: "/admin/districts", label: "Districts", icon: Building2, tourId: "admin-districts" }
      : isDistrictAdmin
        ? { href: "/admin/districts", label: "District", icon: Building2, tourId: "admin-districts" }
      : { href: "/admin", label: "Overview", icon: LayoutDashboard, tourId: "admin-overview" },
    ...sharedLinks.slice(0, 2),
    sharedLinks[2],
    ...(isSuperAdmin
      ? [
          { href: "/admin/feedback", label: "Support inbox", icon: Inbox, tourId: "admin-support" },
          { href: "/admin/offboarding", label: "Tenant offboarding", icon: ArchiveX, tourId: "admin-offboarding" },
        ]
      : []),
    ...sharedLinks.slice(3),
    ...(isSuperAdmin
      ? [{ href: "/admin/system-health", label: "System health", icon: Activity, tourId: "admin-system-health" }]
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
