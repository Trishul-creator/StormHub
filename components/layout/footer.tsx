import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/schools";
import { APP_NAME } from "@/lib/utils";

export function Footer() {
  return (
    <footer className="border-t bg-storm-navy text-storm-silver">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <p className="text-lg font-bold text-white">{APP_NAME}</p>
            <p className="mt-2 text-sm max-w-md">
              Student-built opportunity hub for school communities. Discover clubs, opportunities, and everything happening on the school calendar.
            </p>
            <p className="mt-4 text-xs text-storm-silver">
              Student-built platform. Not an official school system unless approved by school administration.
            </p>
            <p className="mt-2 text-xs text-storm-silver">
              Need help? Use the contact form or email {SUPPORT_EMAIL}.
            </p>
          </div>
          <div>
            <p className="mb-3 font-semibold text-white">Explore</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/clubs" className="hover:text-white transition-colors">Clubs</Link></li>
              <li><Link href="/opportunities" className="hover:text-white transition-colors">Opportunities</Link></li>
              <li><Link href="/calendar" className="hover:text-white transition-colors">Calendar</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 font-semibold text-white">Info</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors">Student privacy</Link></li>
              <li><Link href="/acceptable-use" className="hover:text-white transition-colors">Acceptable use</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-storm-blue pt-8 text-center text-xs text-storm-silver">
          © {new Date().getFullYear()} {APP_NAME} · Privacy-first · Built for students
        </div>
      </div>
    </footer>
  );
}
