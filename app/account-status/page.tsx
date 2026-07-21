import { Ban, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { SUPPORT_EMAIL } from "@/lib/schools";

export default async function AccountStatusPage() {
  const { profile } = await requireAuth("/account-status");
  if (!profile.account_status || profile.account_status === "active") {
    return null;
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Ban className="h-5 w-5" /> Account unavailable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>Your StormHub account is {profile.account_status}. School content and actions are unavailable until an administrator reviews it.</p>
          <Button asChild><a href={`mailto:${SUPPORT_EMAIL}`}><Mail className="h-4 w-4" /> Contact support</a></Button>
        </CardContent>
      </Card>
    </div>
  );
}
