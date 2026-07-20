import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { MfaSetup } from "@/components/auth/mfa-setup";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";

export default async function MfaPage() {
  const { profile } = await requireAuth("/auth/mfa");
  if (profile.role !== "admin" && profile.role !== "super_admin") redirect("/dashboard");

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Admin verification</CardTitle>
          <CardDescription>Use an authenticator app before opening privileged school or platform controls.</CardDescription>
        </CardHeader>
        <CardContent><MfaSetup /></CardContent>
      </Card>
    </div>
  );
}
