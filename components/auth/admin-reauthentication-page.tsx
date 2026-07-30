"use client";

import { useRouter } from "next/navigation";
import { AdminReauthenticationDialog } from "@/components/auth/admin-reauthentication-dialog";

export function AdminReauthenticationPage({
  email,
  returnTo,
}: {
  email: string;
  returnTo: string;
}) {
  const router = useRouter();

  function finish() {
    router.replace(returnTo);
    router.refresh();
  }

  return (
    <AdminReauthenticationDialog
      open
      onOpenChange={(open) => {
        if (!open) finish();
      }}
      email={email}
      returnTo={returnTo}
      onVerified={finish}
    />
  );
}
