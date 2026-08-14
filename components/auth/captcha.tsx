"use client";

import HCaptcha from "@hcaptcha/react-hcaptcha";
import { useLanguage } from "@/components/i18n/language-provider";

export function Captcha({
  onToken,
}: {
  onToken: (token: string | null) => void;
}) {
  const { locale } = useLanguage();
  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY?.trim();
  if (!siteKey) return null;

  return (
    <div className="flex min-h-20 items-center justify-center overflow-hidden" data-testid="captcha">
      <HCaptcha
        sitekey={siteKey}
        languageOverride={locale}
        onVerify={(token) => onToken(token)}
        onExpire={() => onToken(null)}
        onError={() => onToken(null)}
      />
    </div>
  );
}
