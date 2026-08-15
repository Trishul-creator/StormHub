"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { safeAuthRedirectPath } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/i18n/language-provider";

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.63-2.43l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.39 13.86A6.02 6.02 0 0 1 6.07 12c0-.65.11-1.28.32-1.86V7.52H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.48l3.35-2.62Z" />
      <path fill="#EA4335" d="M12 6.01c1.47 0 2.79.51 3.83 1.5l2.87-2.88A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.52l3.35 2.62C7.18 7.77 9.39 6.01 12 6.01Z" />
    </svg>
  );
}

export function GoogleAuthButton({ next }: { next?: string | null }) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);

  async function continueWithGoogle() {
    const supabase = createClient();
    if (!supabase) {
      toast({
        title: t("auth.googleUnavailable"),
        description: t("auth.notConfigured"),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const queryRedirect = new URLSearchParams(window.location.search).get("redirect");
    const destination = safeAuthRedirectPath(next ?? queryRedirect);
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", destination);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callback.toString(),
        scopes: "openid email profile",
        queryParams: { prompt: "select_account" },
      },
    });

    if (error) {
      setLoading(false);
      toast({
        title: t("auth.googleFailed"),
        description: error.message || t("auth.tryAgain"),
        variant: "destructive",
      });
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full gap-2 bg-background"
      disabled={loading}
      onClick={continueWithGoogle}
    >
      <GoogleMark />
      {loading ? t("auth.openingGoogle") : t("auth.continueGoogle")}
    </Button>
  );
}
