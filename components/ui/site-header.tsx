"use client";

import { PasserLogo } from "./passer-logo";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Compass, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

interface SiteHeaderProps {
  showNav?: boolean;
  activePage?: "dashboard" | "upload" | "profile" | "explore";
}

export function SiteHeader({ showNav = false, activePage }: SiteHeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <header className="bg-[#0047AB] px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {showNav ? (
          <Link href="/dashboard">
            <PasserLogo />
          </Link>
        ) : (
          <div className="cursor-default">
            <PasserLogo />
          </div>
        )}

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
              href="/explore"
              className={
                activePage === "explore"
                  ? "text-[#F5A623] font-medium"
                  : "text-white hover:text-gray-200"
              }
            >
              <span className="flex items-center gap-1.5">
                <Compass className="w-4 h-4" />
                Explore
              </span>
            </Link>
            <Link
              href="/upload-page"
              className={
                activePage === "upload"
                  ? "text-[#F5A623] font-medium"
                  : "text-white hover:text-gray-200"
              }
            >
              Upload Video
            </Link>
            <Link
              href="/profile"
              className={
                activePage === "profile"
                  ? "text-[#F5A623] font-medium"
                  : "text-white hover:text-gray-200"
              }
            >
              Profile
            </Link>
            <Button
              variant="outline"
              className="bg-transparent border-[#F5A623] text-[#F5A623] hover:bg-[#F5A623]/10"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </nav>
        )}
      </div>
    </header>
  );
}
