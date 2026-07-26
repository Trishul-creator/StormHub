"use client";

import {
  Building2,
  CheckSquare2,
  FilePenLine,
  LayoutDashboard,
  Mail,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { WorkspaceNavigation, type WorkspaceNavigationLink } from "@/components/layout/workspace-navigation";
import type { UserRole } from "@/types/database";

interface ManagementNavigationProps {
  role: UserRole;
  canApprove: boolean;
  canAdminister: boolean;
}

export function ManagementNavigation({
  role,
  canApprove,
  canAdminister,
}: ManagementNavigationProps) {
  const links: WorkspaceNavigationLink[] = [
    { href: "/manage", label: "Overview", icon: LayoutDashboard },
    { href: "/manage/clubs", label: "Clubs", icon: Users },
    ...(["teacher", "admin", "super_admin"].includes(role)
      ? [{ href: "/manage/clubs/drafts", label: "Drafts", icon: FilePenLine }]
      : []),
    ...(canAdminister
      ? [{ href: "/manage/opportunities", label: "Opportunities", icon: Sparkles }]
      : []),
    ...(canApprove
      ? [{ href: "/manage/approvals", label: "Approvals", icon: CheckSquare2 }]
      : []),
    ...(["teacher", "admin", "super_admin"].includes(role)
      ? [{ href: "/manage/digest", label: "Digest", icon: Mail }]
      : []),
    ...(canAdminister
      ? [{ href: "/admin", label: "Administration", icon: ShieldCheck }]
      : []),
  ];

  return (
    <WorkspaceNavigation
      ariaLabel="Management"
      eyebrow={role === "admin" ? "School" : role === "teacher" ? "Sponsor" : "Club"}
      title="Management"
      icon={Building2}
      links={links}
    />
  );
}
