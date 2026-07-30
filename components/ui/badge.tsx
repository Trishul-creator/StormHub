import { cn } from "@/lib/cn";
import { clubRoleLabel } from "@/lib/club-roles";
import { humanizeLabel } from "@/lib/utils";
import type { MembershipRole } from "@/types/database";

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "destructive";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "bg-storm-electric/10 text-storm-electric border-storm-electric/20",
    secondary: "bg-storm-light text-storm-navy border-storm-silver/30",
    outline: "border border-storm-light text-storm-navy",
    success: "bg-green-100 text-green-800 border-green-200 dark:border-green-800 dark:bg-green-950/70 dark:text-green-200",
    warning: "bg-amber-100 text-amber-800 border-amber-200 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-200",
    destructive: "bg-red-100 text-red-800 border-red-200 dark:border-red-800 dark:bg-red-950/70 dark:text-red-200",
  };
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export function CategoryBadge({ category }: { category: string }) {
  return <Badge variant="secondary">{humanizeLabel(category)}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
    approved: "success",
    pending: "warning",
    submitted: "warning",
    draft: "secondary",
    rejected: "destructive",
    closed: "warning",
    archived: "secondary",
    active: "success",
    going: "success",
    open: "warning",
    reviewed: "secondary",
    resolved: "success",
    requested: "warning",
    under_review: "warning",
    export_ready: "default",
    scheduled: "warning",
    completed: "success",
    cancelled: "secondary",
  };
  const labels: Record<string, string> = {
    submitted: "Submitted",
    approved: "Approved",
    rejected: "Rejected",
    pending: "Pending",
    draft: "Draft",
    closed: "Closed",
    archived: "Archived",
    open: "Open",
    reviewed: "Reviewed",
    resolved: "Resolved",
    requested: "Requested",
    under_review: "Under review",
    export_ready: "Export ready",
    scheduled: "Scheduled",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return <Badge variant={map[status] || "default"}>{labels[status] || humanizeLabel(status)}</Badge>;
}

export function ApprovalStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status} />;
}

export function RoleBadge({ role }: { role: string }) {
  const clubRoles: MembershipRole[] = ["member", "officer", "president", "sponsor"];
  const label = clubRoles.includes(role as MembershipRole)
    ? clubRoleLabel(role as MembershipRole)
    : humanizeLabel(role);
  return <Badge variant="outline">{label}</Badge>;
}

export function EventTypeBadge({ type }: { type: string }) {
  return <Badge>{humanizeLabel(type)}</Badge>;
}
