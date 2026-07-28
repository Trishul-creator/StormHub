import Link from "next/link";
import { Eye, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PublicDemoNotice({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-blue-200 bg-blue-50/80 text-blue-950 shadow-sm dark:border-blue-900/70 dark:bg-blue-950/45 dark:text-blue-100 ${
        compact ? "px-4 py-3" : "p-4 sm:p-5"
      }`}
      role="status"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-storm-electric shadow-sm">
            <Eye className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="font-semibold">You’re viewing fictional sample data</p>
            <p className="mt-0.5 text-sm text-blue-900/75 dark:text-blue-200/80">
              Public visitors see a demonstration catalog. Sign in to view the real clubs,
              events, and opportunities available at your school.
            </p>
          </div>
        </div>
        <Button size="sm" asChild className="shrink-0">
          <Link href="/auth/sign-in">
            <LogIn className="h-4 w-4" /> Sign in for school data
          </Link>
        </Button>
      </div>
    </div>
  );
}
