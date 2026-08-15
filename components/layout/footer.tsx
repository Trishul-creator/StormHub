"use client";

import Link from "next/link";
import { APP_NAME } from "@/lib/utils";
import { useLanguage } from "@/components/i18n/language-provider";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "stormhubsupport@gmail.com";

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t bg-storm-navy text-storm-silver">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <p className="text-lg font-bold text-white">{APP_NAME}</p>
            <p className="mt-2 text-sm max-w-md">
              {t("footer.summary")}
            </p>
            <p className="mt-4 text-xs text-storm-silver">
              {t("footer.disclaimer")}
            </p>
            <p className="mt-2 text-xs text-storm-silver">
              {t("footer.help", { email: SUPPORT_EMAIL })}
            </p>
          </div>
          <div>
            <p className="mb-3 font-semibold text-white">{t("footer.explore")}</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/clubs" className="hover:text-white transition-colors">{t("common.clubs")}</Link></li>
              <li><Link href="/opportunities" className="hover:text-white transition-colors">{t("common.opportunities")}</Link></li>
              <li><Link href="/calendar" className="hover:text-white transition-colors">{t("common.calendar")}</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 font-semibold text-white">{t("footer.info")}</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/about" className="hover:text-white transition-colors">{t("footer.about")}</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors">{t("footer.privacy")}</Link></li>
              <li><Link href="/acceptable-use" className="hover:text-white transition-colors">{t("footer.acceptableUse")}</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">{t("footer.terms")}</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">{t("footer.contact")}</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-storm-blue pt-8 text-center text-xs text-storm-silver">
          © {new Date().getFullYear()} {APP_NAME} · {t("footer.tagline")}
        </div>
      </div>
    </footer>
  );
}
