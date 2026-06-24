import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({ title, description, actionLabel, actionHref }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-storm-light/20 py-12 px-6 text-center">
      <Inbox className="mb-4 h-10 w-10 text-storm-silver" />
      <h3 className="font-semibold text-storm-navy">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {actionLabel && actionHref && (
        <Button asChild className="mt-4" variant="outline">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
    </div>
  );
}

export function LoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-storm-electric border-t-transparent" />
      <span className="ml-3 text-muted-foreground">{message}</span>
    </div>
  );
}
