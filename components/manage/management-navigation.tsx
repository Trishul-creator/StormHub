"use client";

import {
  Building2,
  CheckSquare2,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();
  if (pathname.startsWith("/manage/clubs") || pathname.startsWith("/manage/opportunities")) {
    return null;
  }

  const links: WorkspaceNavigationLink[] = [
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
  if (links.length === 0) return null;

  return (
    <WorkspaceNavigation
      ariaLabel="Management"
      eyebrow={role === "admin" ? "School" : role === "teacher" ? "Sponsor" : "Club"}
      title="Management tools"
      icon={Building2}
      links={links}
    />
  );
}
