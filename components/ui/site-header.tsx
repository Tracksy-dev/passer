"use client";

import { PasserLogo } from "./passer-logo";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Compass, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { motion, useReducedMotion } from "framer-motion";

interface SiteHeaderProps {
  showNav?: boolean;
  activePage?: "dashboard" | "upload" | "profile" | "explore";
}

export function SiteHeader({ showNav = false, activePage }: SiteHeaderProps) {
  const prefersReducedMotion = useReducedMotion();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <motion.header
      initial={prefersReducedMotion ? false : { opacity: 0, y: -12 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      transition={
        prefersReducedMotion
          ? undefined
          : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }
      }
      className="bg-[#0047AB] px-4 md:px-6 lg:px-8 py-3 md:py-4"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 md:gap-4">
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
          <motion.nav
            initial={prefersReducedMotion ? false : { opacity: 0, y: -6 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={
              prefersReducedMotion
                ? undefined
                : { duration: 0.25, delay: 0.05, ease: [0.22, 1, 0.36, 1] }
            }
            className="flex items-center justify-end gap-2 md:gap-3 lg:gap-7 flex-wrap"
          >
            <Link
              href="/dashboard"
              className={`text-sm md:text-[15px] ${
                activePage === "dashboard"
                  ? "text-[#F5A623] font-medium"
                  : "text-white hover:text-gray-200"
              }`}
            >
              <motion.span
                whileHover={prefersReducedMotion ? undefined : { y: -1 }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
                className="inline-block"
              >
                Dashboard
              </motion.span>
            </Link>
            <Link
              href="/explore"
              className={`text-sm md:text-[15px] ${
                activePage === "explore"
                  ? "text-[#F5A623] font-medium"
                  : "text-white hover:text-gray-200"
              }`}
            >
              <motion.span
                whileHover={prefersReducedMotion ? undefined : { y: -1 }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
                className="flex items-center gap-1.5"
              >
                <Compass className="w-4 h-4" />
                Explore
              </motion.span>
            </Link>
            <Link
              href="/upload-page"
              className={`text-sm md:text-[15px] ${
                activePage === "upload"
                  ? "text-[#F5A623] font-medium"
                  : "text-white hover:text-gray-200"
              }`}
            >
              <motion.span
                whileHover={prefersReducedMotion ? undefined : { y: -1 }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
                className="inline-block"
              >
                Upload Video
              </motion.span>
            </Link>
            <Link
              href="/profile"
              className={`text-sm md:text-[15px] ${
                activePage === "profile"
                  ? "text-[#F5A623] font-medium"
                  : "text-white hover:text-gray-200"
              }`}
            >
              <motion.span
                whileHover={prefersReducedMotion ? undefined : { y: -1 }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
                className="inline-block"
              >
                Profile
              </motion.span>
            </Link>
            <Button
              variant="outline"
              className="h-9 px-3 md:px-4 bg-transparent border-[#F5A623] text-[#F5A623] hover:bg-[#F5A623]/10"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </motion.nav>
        )}
      </div>
    </motion.header>
  );
}
