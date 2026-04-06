"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, Upload, Video, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const STORAGE_KEY = "passer_onboarding_dismissed";

export function OnboardingBanner() {
  const prefersReducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-2xl overflow-hidden border border-[#1B7CFF]/25 bg-[linear-gradient(135deg,#eef6ff,#f5f0ff)]"
        >
          {/* Decorative background blobs */}
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-[#1B7CFF]/8 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-[#E8A550]/10 blur-3xl pointer-events-none" />

          {/* Dismiss button */}
          <button
            onClick={dismiss}
            className="absolute top-4 right-4 rounded-full p-1.5 text-[#6a86a8] hover:bg-white/60 hover:text-[#0047AB] transition-colors z-10"
            aria-label="Dismiss welcome message"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="relative z-10 p-6 md:p-8">
            {/* Heading */}
            <div className="mb-5">
              <span className="chip-kicker mb-2 inline-block">Welcome to Passer</span>
              <h2 className="text-xl md:text-2xl font-semibold text-[#0f2d5c] leading-snug">
                Ready to analyse your first match?
              </h2>
              <p className="text-sm text-[#4a6e97] mt-1.5 max-w-lg">
                Upload a match video, mark your key moments, and generate a highlight reel — all in a few clicks.
              </p>
            </div>

            {/* Steps */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              {[
                {
                  icon: Upload,
                  step: "1",
                  title: "Upload a match",
                  desc: "Drop in your video file — mp4, mov or avi, up to 500MB.",
                },
                {
                  icon: Video,
                  step: "2",
                  title: "Mark highlights",
                  desc: "Watch the footage and tag key moments like spikes, blocks and aces.",
                },
                {
                  icon: BarChart2,
                  step: "3",
                  title: "Get your reel",
                  desc: "Generate a highlight reel from your tagged moments and share it.",
                },
              ].map(({ icon: Icon, step, title, desc }) => (
                <div
                  key={step}
                  className="flex items-start gap-3 rounded-xl bg-white/60 border border-white/80 p-4 backdrop-blur-sm"
                >
                  <div className="w-8 h-8 rounded-full bg-[#0047AB]/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-[#0047AB]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#0047AB] mb-0.5">Step {step}</p>
                    <p className="text-sm font-semibold text-[#0f2d5c]">{title}</p>
                    <p className="text-xs text-[#6a86a8] mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="flex items-center gap-3 flex-wrap">
              <Button asChild className="h-10 px-6">
                <Link href="/upload-page">Upload your first match</Link>
              </Button>
              <button
                onClick={dismiss}
                className="text-sm text-[#6a86a8] hover:text-[#0047AB] transition-colors"
              >
                I'll do this later
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
