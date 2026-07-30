"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail } from "lucide-react";

import { updateSchoolSignupDomains } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  beginAdminReauthentication,
  needsAdminReauthentication,
} from "@/lib/admin-step-up-shared";

export function SignupDomainSettings({
  schoolId,
  schoolName,
  domains,
}: {
  schoolId: string;
  schoolName: string;
  domains: string[];
}) {
  const [value, setValue] = useState(domains.join(", "));
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const allowsEveryDomain = domains.includes("*");

  function save() {
    startTransition(async () => {
      const result = await updateSchoolSignupDomains({ schoolId, domains: value });
      if (result.success) {
        const savedDomains = result.domains ?? [];
        setValue(savedDomains.join(", "));
        toast({
          title: "Signup email settings updated",
          description: savedDomains.includes("*")
            ? `${schoolName} now accepts every verified email domain.`
            : `${schoolName} now accepts ${savedDomains.join(", ")}.`,
        });
        router.refresh();
      } else if (needsAdminReauthentication(result)) {
        beginAdminReauthentication();
      } else {
        toast({ title: "Could not update signup domains", description: result.error, variant: "destructive" });
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-storm-electric" />
          <CardTitle className="text-lg">Accepted signup emails</CardTitle>
        </div>
        <CardDescription>
          {allowsEveryDomain
            ? `${schoolName} currently accepts every verified email domain.`
            : `Only the listed email domains can create accounts for ${schoolName}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor={`signup-domains-${schoolId}`}>Accepted email domains</Label>
          <Input
            id={`signup-domains-${schoolId}`}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="* or students.example.edu, staff.example.edu"
            className="mt-1"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Enter <code>*</code> by itself to allow every domain, or enter a comma-separated list to restrict signup.
          </p>
        </div>
        <Button type="button" onClick={save} disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save email settings
        </Button>
      </CardContent>
    </Card>
  );
}
