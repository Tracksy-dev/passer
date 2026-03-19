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
      className="sticky top-0 z-50 px-4 md:px-6 lg:px-8 pt-3 md:pt-4"
    >
      <div className="max-w-7xl mx-auto glass-surface aurora-border hover-border-glow px-4 py-3 md:px-5 md:py-3.5">
        <div className="flex items-center justify-between gap-3 md:gap-4">
          {showNav ? (
            <Link href="/dashboard">
              <PasserLogo />
            </Link>
          ) : (
            <div className="cursor-default">
              <PasserLogo />
            </div>
          )}

          {showNav ? (
            <motion.nav
              initial={prefersReducedMotion ? false : { opacity: 0, y: -6 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              transition={
                prefersReducedMotion
                  ? undefined
                  : { duration: 0.25, delay: 0.05, ease: [0.22, 1, 0.36, 1] }
              }
              className="flex items-center justify-end gap-1.5 md:gap-2 lg:gap-2.5 flex-wrap"
            >
              <Link
                href="/dashboard"
                className={`rounded-full px-3 py-1.5 text-sm md:text-[14px] transition-colors ${
                  activePage === "dashboard"
                    ? "bg-[#0047AB] text-white shadow-sm"
                    : "text-[#0A3D7D] hover:bg-[#1B7CFF]/12"
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
                className={`rounded-full px-3 py-1.5 text-sm md:text-[14px] transition-colors ${
                  activePage === "explore"
                    ? "bg-[#0047AB] text-white shadow-sm"
                    : "text-[#0A3D7D] hover:bg-[#1B7CFF]/12"
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
                className={`rounded-full px-3 py-1.5 text-sm md:text-[14px] transition-colors ${
                  activePage === "upload"
                    ? "bg-[#0047AB] text-white shadow-sm"
                    : "text-[#0A3D7D] hover:bg-[#1B7CFF]/12"
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
                className={`rounded-full px-3 py-1.5 text-sm md:text-[14px] transition-colors ${
                  activePage === "profile"
                    ? "bg-[#0047AB] text-white shadow-sm"
                    : "text-[#0A3D7D] hover:bg-[#1B7CFF]/12"
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
                className="h-9 px-3 md:px-4 border-[#e8a550]/70 text-[#b36b0f] hover:bg-[#e8a550]/12"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </motion.nav>
          ) : (
            <p className="hidden md:block text-xs font-medium uppercase tracking-[0.14em] text-[#0B4A97]/70">
              Volleyball Intelligence
            </p>
          )}
        </div>
      </div>
    </motion.header>
  );
}
