"use client";

import { useState, useTransition } from "react";
import { Clock3, Eye, Loader2, ShieldAlert, X } from "lucide-react";
import {
  endPlatformSupportSession,
  startPlatformSupportSession,
} from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import type { PlatformSupportSession } from "@/lib/support-access";

export function PlatformSupportAccess({
  schoolId,
  schoolName,
  initialSession,
}: {
  schoolId: string;
  schoolName: string;
  initialSession: PlatformSupportSession | null;
}) {
  const [session, setSession] = useState(initialSession);
  const [pending, startTransition] = useTransition();

  function start(formData: FormData) {
    startTransition(async () => {
      const result = await startPlatformSupportSession({
        schoolId,
        reason: String(formData.get("reason") ?? ""),
        durationMinutes: Number(formData.get("durationMinutes") ?? 30),
      });
      if (!result.success || !result.expiresAt) {
        toast({
          title: "Could not start support access",
          description: result.error,
          variant: "destructive",
        });
        return;
      }
      setSession({
        id: "active",
        actor_user_id: "",
        school_id: schoolId,
        reason: String(formData.get("reason") ?? ""),
        started_at: new Date().toISOString(),
        expires_at: result.expiresAt,
        ended_at: null,
      });
      toast({
        title: "Read-only support access started",
        description: `Access ends automatically at ${new Date(result.expiresAt).toLocaleTimeString()}.`,
      });
    });
  }

  function end() {
    startTransition(async () => {
      const result = await endPlatformSupportSession(schoolId);
      if (!result.success) {
        toast({
          title: "Could not end support access",
          description: result.error,
          variant: "destructive",
        });
        return;
      }
      setSession(null);
      toast({ title: "Support access ended" });
    });
  }

  return (
    <Card className={session ? "border-amber-300 dark:border-amber-800" : undefined}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-storm-electric" />
          <CardTitle className="text-lg">Private-data support access</CardTitle>
        </div>
        <CardDescription>
          Platform admins can manage ordinary workspace settings without this. Start a temporary,
          read-only session only when troubleshooting real student coursework.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {session ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              <p className="flex items-center gap-2 font-semibold">
                <Eye className="h-4 w-4" /> Support access is active
              </p>
              <p className="mt-2 text-sm">{session.reason}</p>
              <p className="mt-2 flex items-center gap-2 text-xs">
                <Clock3 className="h-3.5 w-3.5" />
                Ends automatically {new Date(session.expires_at).toLocaleString()}
              </p>
            </div>
            <Button type="button" variant="outline" onClick={end} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              End access now
            </Button>
          </div>
        ) : (
          <form action={start} className="space-y-4">
            <div>
              <Label htmlFor={`support-reason-${schoolId}`}>Support reason</Label>
              <Textarea
                id={`support-reason-${schoolId}`}
                name="reason"
                required
                minLength={10}
                maxLength={500}
                rows={3}
                className="mt-1"
                placeholder={`Example: Investigating an attachment that the ${schoolName} Advisor cannot open.`}
              />
            </div>
            <div>
              <Label htmlFor={`support-duration-${schoolId}`}>Duration</Label>
              <select
                id={`support-duration-${schoolId}`}
                name="durationMinutes"
                defaultValue="30"
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-52"
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">60 minutes</option>
              </select>
            </div>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Start read-only support
            </Button>
            <p className="text-xs text-muted-foreground">
              The reason, session, coursework pages, and private downloads are recorded. School
              administrators are notified when access starts.
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
