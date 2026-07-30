"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2 } from "lucide-react";
import { deactivateGraduatingStudents } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  beginAdminReauthentication,
  needsAdminReauthentication,
} from "@/lib/admin-step-up-shared";

export function GraduationCleanup() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run() {
    if (!window.confirm(`Deactivate every active grade 12 student as the class of ${year}? Accounts can be reactivated individually.`)) return;
    startTransition(async () => {
      const result = await deactivateGraduatingStudents(year);
      if (needsAdminReauthentication(result)) {
        beginAdminReauthentication();
        return;
      }
      toast({
        title: result.success ? "Graduation cleanup complete" : "Graduation cleanup needs review",
        description: result.success ? `${result.count ?? 0} accounts were deactivated.` : result.error,
        variant: result.success ? "default" : "destructive",
      });
      router.refresh();
    });
  }

  return (
    <div className="mb-6 flex flex-wrap items-end gap-3 border-b pb-6">
      <div>
        <label htmlFor="graduation-year" className="text-sm font-medium">Graduation year</label>
        <Input id="graduation-year" type="number" min={2000} max={2200} value={year} onChange={(event) => setYear(Number(event.target.value))} className="mt-1 w-36" />
      </div>
      <Button variant="outline" onClick={run} disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />}
        Deactivate grade 12
      </Button>
    </div>
  );
}
