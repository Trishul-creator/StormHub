import { cn } from "@/lib/cn";
import { humanizeLabel } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "destructive";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "bg-storm-electric/10 text-storm-electric border-storm-electric/20",
    secondary: "bg-storm-light text-storm-navy border-storm-silver/30",
    outline: "border border-storm-light text-storm-navy",
    success: "bg-green-100 text-green-800 border-green-200",
    warning: "bg-amber-100 text-amber-800 border-amber-200",
    destructive: "bg-red-100 text-red-800 border-red-200",
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
    active: "success",
    going: "success",
    open: "warning",
    reviewed: "secondary",
    resolved: "success",
  };
  const labels: Record<string, string> = {
    submitted: "Submitted",
    approved: "Approved",
    rejected: "Rejected",
    pending: "Pending",
    draft: "Draft",
    open: "Open",
    reviewed: "Reviewed",
    resolved: "Resolved",
  };
  return <Badge variant={map[status] || "default"}>{labels[status] || humanizeLabel(status)}</Badge>;
}

export function ApprovalStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status} />;
}

export function RoleBadge({ role }: { role: string }) {
  return <Badge variant="outline">{humanizeLabel(role)}</Badge>;
}

export function EventTypeBadge({ type }: { type: string }) {
  return <Badge>{humanizeLabel(type)}</Badge>;
}
