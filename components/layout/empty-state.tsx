import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  actions?: Array<{
    label: string;
    href: string;
  }>;
}

export function EmptyState({ title, description, actionLabel, actionHref, actions = [] }: EmptyStateProps) {
  const normalizedActions =
    actions.length > 0
      ? actions
      : actionLabel && actionHref
        ? [{ label: actionLabel, href: actionHref }]
        : [];

  return (
    <div className="motion-block flex flex-col items-center justify-center rounded-xl border border-dashed bg-gradient-to-b from-white to-storm-light/25 px-6 py-12 text-center shadow-sm">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-storm-light/60 text-storm-blue shadow-inner">
        <Inbox className="h-7 w-7" />
      </div>
      <h3 className="font-semibold text-storm-navy">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {normalizedActions.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {normalizedActions.map((action) => (
            <Button key={`${action.href}-${action.label}`} asChild variant="outline">
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ))}
        </div>
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
