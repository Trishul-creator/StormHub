import { AdminReauthenticationPage } from "@/components/auth/admin-reauthentication-page";
import { requireAdmin } from "@/lib/auth";
import { safeAuthRedirectPath } from "@/lib/auth-redirect";

export default async function ConfirmAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { profile } = await requireAdmin();
  const { next } = await searchParams;
  const returnTo = safeAuthRedirectPath(next, "/admin");

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-storm-subtle px-4 py-12">
      <div className="mx-auto max-w-lg rounded-2xl border bg-card p-6 text-card-foreground shadow-sm">
        <h1 className="text-2xl font-bold text-storm-navy">Administrator identity confirmation</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Confirm with your StormHub password or Google account, then return to the protected
          setting and submit it again.
        </p>
      </div>
      <AdminReauthenticationPage
        email={profile.email ?? ""}
        returnTo={returnTo}
      />
    </main>
  );
}
