"use client";

import Link from "next/link";
import { Facebook, Twitter, Instagram } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

export function SiteFooter() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.footer
      initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      transition={
        prefersReducedMotion
          ? undefined
          : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }
      }
      className="px-4 md:px-6 lg:px-8 pb-5 md:pb-6 mt-8"
    >
      <div className="max-w-7xl mx-auto rounded-2xl border border-[#0a3c79]/20 bg-[linear-gradient(135deg,#083b7f_0%,#0a4d9f_52%,#115fbd_100%)] px-5 py-5 md:px-7 md:py-6 shadow-[0_18px_40px_-30px_rgba(2,24,58,0.95)] flex flex-col md:flex-row items-center justify-between gap-4 md:gap-5 hover-border-glow">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={
            prefersReducedMotion ? undefined : { duration: 0.25, delay: 0.05 }
          }
          className="flex items-center justify-center md:justify-start gap-4 md:gap-6 text-sm text-white/80 flex-wrap"
        >
          <Link href="/privacy" className="hover:text-white transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-white transition-colors">
            Terms of Service
          </Link>
          <Link href="/contact" className="hover:text-white transition-colors">
            Contact Us
          </Link>
        </motion.div>
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={
            prefersReducedMotion ? undefined : { duration: 0.25, delay: 0.1 }
          }
          className="flex items-center gap-4"
        >
          <Link
            href="#"
            className="text-white/80 hover:text-white transition-colors rounded-full border border-white/30 bg-white/10 p-2.5"
          >
            <motion.span
              whileHover={
                prefersReducedMotion ? undefined : { y: -2, scale: 1.05 }
              }
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              className="inline-flex"
            >
              <Facebook className="w-5 h-5" />
            </motion.span>
          </Link>
          <Link
            href="#"
            className="text-white/80 hover:text-white transition-colors rounded-full border border-white/30 bg-white/10 p-2.5"
          >
            <motion.span
              whileHover={
                prefersReducedMotion ? undefined : { y: -2, scale: 1.05 }
              }
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              className="inline-flex"
            >
              <Twitter className="w-5 h-5" />
            </motion.span>
          </Link>
          <Link
            href="#"
            className="text-white/80 hover:text-white transition-colors rounded-full border border-white/30 bg-white/10 p-2.5"
          >
            <motion.span
              whileHover={
                prefersReducedMotion ? undefined : { y: -2, scale: 1.05 }
              }
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              className="inline-flex"
            >
              <Instagram className="w-5 h-5" />
            </motion.span>
          </Link>
        </motion.div>
      </div>
    </motion.footer>
  );
}
