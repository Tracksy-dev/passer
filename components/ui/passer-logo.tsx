"use client";

import { motion, useReducedMotion } from "framer-motion";

export function PasserLogo({ className = "w-6 h-6" }: { className?: string }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="group flex items-center gap-2.5">
      <motion.div
        className={`${className} relative overflow-hidden rounded-full border border-white/70 bg-white/90 shadow-[0_8px_20px_-12px_rgba(0,71,171,0.9)] flex items-center justify-center`}
        animate={
          prefersReducedMotion
            ? undefined
            : {
                boxShadow: [
                  "0 8px 20px -12px rgba(0,71,171,0.9)",
                  "0 8px 28px -10px rgba(27,124,255,0.7)",
                  "0 8px 20px -12px rgba(0,71,171,0.9)",
                ],
              }
        }
        transition={
          prefersReducedMotion
            ? undefined
            : { duration: 3, repeat: Infinity, ease: "easeInOut" }
        }
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#e9f4ff] via-white to-[#ffe6c5]" />
        <svg
          viewBox="0 0 24 24"
          className="relative w-4 h-4"
          fill="none"
          stroke="#0047AB"
          strokeWidth="2.5"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3v18M3 12h18" />
        </svg>
      </motion.div>
      <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#073f8f] via-[#0f5fc8] to-[#e0902c] font-semibold text-lg tracking-tight">
        Passer
      </span>
    </div>
  );
}
