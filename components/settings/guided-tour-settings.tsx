import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/types/database";

export function GuidedTourSettings({ role }: { role: UserRole }) {
  const href =
    role === "super_admin"
      ? "/admin/schools?tour=1"
      : role === "admin" || role === "teacher"
        ? "/manage?tour=1"
        : "/dashboard?tour=1";

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-storm-electric dark:bg-blue-950/60 dark:text-blue-300">
          <Compass className="h-5 w-5" />
        </div>
        <div>
          <p className="font-medium text-storm-navy">StormHub walkthrough</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Replay the guided tour for your current role and review where the main tools live.
          </p>
        </div>
      </div>
      <Button variant="outline" asChild className="shrink-0">
        <Link href={href}><Compass className="h-4 w-4" /> Replay walkthrough</Link>
      </Button>
    </div>
  );
}
