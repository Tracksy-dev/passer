import { PasserLogo } from "./passer-logo";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { LogOut } from "lucide-react";

interface SiteHeaderProps {
  showNav?: boolean;
  activePage?: "dashboard" | "upload";
}

export function SiteHeader({ showNav = false, activePage }: SiteHeaderProps) {
  return (
    <header className="bg-[#0047AB] px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/dashboard">
          <PasserLogo />
        </Link>

        {showNav && (
          <nav className="flex items-center gap-8">
            <Link
              href="/dashboard"
              className={
                activePage === "dashboard"
                  ? "text-[#F5A623] font-medium"
                  : "text-white hover:text-gray-200"
              }
            >
              Dashboard
            </Link>
            <Link
              href="/upload"
              className={
                activePage === "upload"
                  ? "text-[#F5A623] font-medium"
                  : "text-white hover:text-gray-200"
              }
            >
              Upload Video
            </Link>
            <Link href="/login">
              <Button
                variant="outline"
                className="bg-transparent border-[#F5A623] text-[#F5A623] hover:bg-[#F5A623]/10"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
