import { PasserLogo } from "./passer-logo";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function SiteHeader({ showNav = false }: { showNav?: boolean }) {
  return (
    <header className="bg-[#0047AB] px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/">
          <PasserLogo />
        </Link>

        {showNav && (
          <nav className="flex items-center gap-8">
            <Link
              href="/dashboard"
              className="text-[#F5A623] font-medium hover:text-[#E8A550]"
            >
              Dashboard
            </Link>
            <Link
              href="/upload-page"
              className="text-white hover:text-gray-200"
            >
              Upload Video
            </Link>
             <Link
              href="/profile"
              className="text-white hover:text-gray-200"
            >
              Profile
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
