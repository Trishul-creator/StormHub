"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound, Loader2, RefreshCw, Save } from "lucide-react";
import { rotateSchoolSignupAccessCode, setSchoolSignupAccessCode } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  beginAdminReauthentication,
  needsAdminReauthentication,
} from "@/lib/admin-step-up-shared";

export function SchoolAccessCodeSettings({
  schoolId,
  schoolName,
  initialCode,
  initialRotatedAt,
}: {
  schoolId: string;
  schoolName: string;
  initialCode: string | null;
  initialRotatedAt?: string | null;
}) {
  const [code, setCode] = useState(initialCode);
  const [customCode, setCustomCode] = useState(initialCode ?? "");
  const [rotatedAt, setRotatedAt] = useState(initialRotatedAt ?? null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  async function copyCode() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  }

  function rotate() {
    if (
      code
      && !window.confirm(
        `Generate a new access code for ${schoolName}? The current code will stop working immediately.`
      )
    ) return;
    startTransition(async () => {
      const result = await rotateSchoolSignupAccessCode(schoolId);
      if (!result.success || !result.accessCode) {
        if (needsAdminReauthentication(result)) {
          beginAdminReauthentication();
          return;
        }
        toast({
          title: "Could not rotate access code",
          description: result.error,
          variant: "destructive",
        });
        return;
      }
      setCode(result.accessCode);
      setCustomCode(result.accessCode);
      setRotatedAt(result.rotatedAt ?? new Date().toISOString());
      toast({
        title: "School access code updated",
        description: "Share the new code only with people who belong to this school.",
      });
    });
  }

  function saveCustomCode() {
    startTransition(async () => {
      const result = await setSchoolSignupAccessCode({ schoolId, accessCode: customCode });
      if (!result.success || !result.accessCode) {
        if (needsAdminReauthentication(result)) {
          beginAdminReauthentication();
          return;
        }
        toast({
          title: "Could not save access code",
          description: result.error,
          variant: "destructive",
        });
        return;
      }
      setCode(result.accessCode);
      setCustomCode(result.accessCode);
      setRotatedAt(result.rotatedAt ?? new Date().toISOString());
      toast({
        title: "Custom access code saved",
        description: "The previous code stopped working immediately.",
      });
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-storm-electric" />
          <CardTitle className="text-lg">School access code</CardTitle>
        </div>
        <CardDescription>
          Every new password or Google account must enter this code before joining {schoolName}.
          Email-domain rules still apply.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {code ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1 rounded-lg border bg-muted/30 px-4 py-3 font-mono text-base font-semibold tracking-wide text-foreground">
              {code}
            </div>
            <Button type="button" variant="outline" onClick={copyCode}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            The privacy-hardening migration has not created a code for this school yet.
          </div>
        )}
        <div className="rounded-xl border bg-muted/20 p-4">
          <Label htmlFor={`custom-access-code-${schoolId}`}>Choose a custom code</Label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Input
              id={`custom-access-code-${schoolId}`}
              value={customCode}
              onChange={(event) => setCustomCode(event.target.value.toUpperCase())}
              minLength={8}
              maxLength={32}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="EAGLES-2026"
              className="font-mono uppercase"
            />
            <Button
              type="button"
              onClick={saveCustomCode}
              disabled={pending || customCode.trim().toUpperCase() === code}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save custom code
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Use 8–32 letters, numbers, or hyphen-separated words, including at least one letter and number.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {rotatedAt
              ? `Last rotated ${new Date(rotatedAt).toLocaleString()}`
              : "Codes are generated automatically when a school is created."}
          </p>
          <Button type="button" variant="outline" onClick={rotate} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {code ? "Rotate code" : "Generate code"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Rotate the code if it is posted publicly or shared outside the school. Existing accounts are not affected.
        </p>
      </CardContent>
    </Card>
  );
}
