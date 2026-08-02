"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ArrowRight, Clock3, DatabaseZap, Eye, Inbox, Loader2, ShieldAlert, X } from "lucide-react";
import {
  endPlatformSupportSession,
  startPlatformSupportSession,
} from "@/lib/actions";
import { AdminReauthenticationDialog } from "@/components/auth/admin-reauthentication-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import type { PlatformSupportSession } from "@/lib/support-access";
import { needsAdminReauthentication } from "@/lib/admin-step-up-shared";

const MAX_BROWSER_TIMEOUT_MS = 2_147_000_000;

export function PlatformSupportAccess({
  schoolId,
  schoolName,
  schoolSlug,
  actorEmail,
  initialSession,
  supportAvailable,
}: {
  schoolId: string;
  schoolName: string;
  schoolSlug: string;
  actorEmail: string;
  initialSession: PlatformSupportSession | null;
  supportAvailable: boolean;
}) {
  const router = useRouter();
  const [session, setSession] = useState(initialSession);
  const [pending, startTransition] = useTransition();
  const [reauthenticationOpen, setReauthenticationOpen] = useState(false);
  const [retryAfterReauthentication, setRetryAfterReauthentication] = useState<(() => void) | null>(null);

  useEffect(() => {
    setSession(initialSession);
  }, [initialSession]);

  useEffect(() => {
    if (!session) return;
    let timer: number | undefined;
    const checkExpiry = () => {
      const remaining = new Date(session.expires_at).getTime() - Date.now();
      if (remaining <= 0) {
        setSession(null);
        router.refresh();
        return;
      }
      timer = window.setTimeout(checkExpiry, Math.min(remaining, MAX_BROWSER_TIMEOUT_MS));
    };
    checkExpiry();
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [router, session]);

  function requestReauthentication(retry: () => void) {
    setRetryAfterReauthentication(() => retry);
    setReauthenticationOpen(true);
  }

  function runStart(input: { reason: string; durationMinutes: number }) {
    startTransition(async () => {
      const result = await startPlatformSupportSession({ schoolId, ...input });
      if (!result.success || !result.session) {
        if (needsAdminReauthentication(result)) {
          requestReauthentication(() => runStart(input));
          return;
        }
        toast({
          title: "Could not start support access",
          description: result.error,
          variant: "destructive",
        });
        return;
      }
      setSession(result.session);
      router.refresh();
      toast({
        title: "Read-only support access started",
        description: `Access ends automatically at ${new Date(result.session.expires_at).toLocaleTimeString()}.`,
      });
    });
  }

  function start(formData: FormData) {
    runStart({
      reason: String(formData.get("reason") ?? ""),
      durationMinutes: Number(formData.get("durationMinutes") ?? 30),
    });
  }

  function end() {
    startTransition(async () => {
      const result = await endPlatformSupportSession(schoolId);
      if (!result.success) {
        if (needsAdminReauthentication(result)) {
          requestReauthentication(end);
          return;
        }
        toast({
          title: "Could not end support access",
          description: result.error,
          variant: "destructive",
        });
        return;
      }
      setSession(null);
      router.refresh();
      toast({ title: "Support access ended" });
    });
  }

  return (
    <>
      <Card
        id="support-access"
        className={session ? "scroll-mt-24 border-amber-300 dark:border-amber-800" : "scroll-mt-24"}
      >
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-storm-electric" />
          <CardTitle className="text-lg">Private-data support access</CardTitle>
        </div>
        <CardDescription>
          Use this only after a support ticket requires inspection of private school records. The
          support inbox itself never requires a private-data session.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-xl border bg-muted/40 p-4">
          <p className="font-semibold text-foreground">How private-data support works</p>
          <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><strong className="text-foreground">1. Read the ticket first.</strong> Most account, navigation, and configuration issues do not require private records.</li>
            <li><strong className="text-foreground">2. Start access only when necessary.</strong> Enter the exact problem and choose the shortest practical session.</li>
            <li><strong className="text-foreground">3. Inspect the minimum data.</strong> The session permits read-only roster, attendance, coursework, and attachment troubleshooting. Views are recorded.</li>
            <li><strong className="text-foreground">4. End access when finished.</strong> Access also expires automatically at the selected time.</li>
          </ol>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href={`/admin/feedback?school=${encodeURIComponent(schoolSlug)}`}>
              Open support inbox <Inbox className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        {!supportAvailable ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="flex items-center gap-2 font-semibold">
              <DatabaseZap className="h-4 w-4" />
              Database update required
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              The privacy and support migration is not available in this environment yet. Support
              access remains safely disabled; no private school data is being shown.
            </p>
          </div>
        ) : session ? (
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
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href={`/admin/schools/${schoolSlug}/support`} className="gap-2">
                  Open read-only workspace <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button type="button" variant="outline" onClick={end} disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                End access now
              </Button>
            </div>
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
      <AdminReauthenticationDialog
        open={reauthenticationOpen}
        onOpenChange={(open) => {
          setReauthenticationOpen(open);
          if (!open) setRetryAfterReauthentication(null);
        }}
        email={actorEmail}
        onVerified={() => retryAfterReauthentication?.()}
      />
    </>
  );
}
