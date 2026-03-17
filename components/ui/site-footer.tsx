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
      className="bg-white border-t border-gray-200 px-4 md:px-6 lg:px-8 py-5 md:py-6"
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 md:gap-5">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={
            prefersReducedMotion ? undefined : { duration: 0.25, delay: 0.05 }
          }
          className="flex items-center justify-center md:justify-start gap-4 md:gap-6 text-sm text-gray-600 flex-wrap"
        >
          <Link href="/privacy" className="hover:text-gray-900">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-gray-900">
            Terms of Service
          </Link>
          <Link href="/contact" className="hover:text-gray-900">
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
          <Link href="#" className="text-gray-600 hover:text-gray-900">
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
          <Link href="#" className="text-gray-600 hover:text-gray-900">
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
          <Link href="#" className="text-gray-600 hover:text-gray-900">
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
