"use client";

import { PasserLogo } from "./passer-logo";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Bell, Compass, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

interface SiteHeaderProps {
  showNav?: boolean;
  activePage?: "dashboard" | "upload" | "profile" | "explore" | "notifications";
}

export function SiteHeader({ showNav = false, activePage }: SiteHeaderProps) {
  const prefersReducedMotion = useReducedMotion();
  const [unreadCount, setUnreadCount] = useState(0);
  const [canShowNotifications, setCanShowNotifications] = useState(false);

  useEffect(() => {
    if (!showNav) return;

    let cancelled = false;

    const fetchUnreadCount = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          if (!cancelled) {
            setCanShowNotifications(false);
            setUnreadCount(0);
          }
          return;
        }

        if (!cancelled) {
          setCanShowNotifications(true);
        }

        const res = await fetch("/api/notifications/unread-count", {
          cache: "no-store",
        });

        if (!res.ok) return;

        const data = (await res.json()) as { unreadCount?: number };
        if (!cancelled) {
          setUnreadCount(Math.max(0, data.unreadCount ?? 0));
        }
      } catch {
        if (!cancelled) {
          setUnreadCount(0);
        }
      }
    };

    fetchUnreadCount();
    const interval = window.setInterval(fetchUnreadCount, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [showNav]);

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
              {canShowNotifications ? (
                <Link
                  href="/notifications"
                  className={`relative rounded-full p-2 transition-colors ${
                    activePage === "notifications"
                      ? "bg-[#0047AB] text-white shadow-sm"
                      : "text-[#0A3D7D] hover:bg-[#1B7CFF]/12"
                  }`}
                  aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 ? (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-[5px] rounded-full bg-[#E84F7A] text-white text-[10px] font-bold leading-none inline-flex items-center justify-center ring-2 ring-white shadow-sm">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  ) : null}
                </Link>
              ) : null}
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
