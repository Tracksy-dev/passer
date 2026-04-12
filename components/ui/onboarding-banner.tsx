"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Upload,
  Sparkles,
  Share2,
  ArrowRight,
  ArrowLeft,
  X,
  MousePointer2,
  Play,
  Tag,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "passer_onboarding_v2_dismissed";

type Step = {
  id: number;
  chip: string;
  title: string;
  description: string;
  illustration: React.ReactNode;
};

// Animated pulsing cursor indicator
function ClickIndicator({ className }: { className?: string }) {
  return (
    <motion.div
      className={`absolute z-10 flex items-center justify-center ${className}`}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.6, duration: 0.3 }}
    >
      <motion.div
        className="w-8 h-8 rounded-full bg-[#E8A550]/30 absolute"
        animate={{ scale: [1, 1.8, 1], opacity: [0.8, 0, 0.8] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="w-4 h-4 rounded-full bg-[#E8A550] border-2 border-white shadow-lg absolute"
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        className="relative top-6 left-3"
      >
        <MousePointer2 className="w-4 h-4 text-[#E8A550] drop-shadow" />
      </motion.div>
    </motion.div>
  );
}

// Step illustrations
function UploadIllustration() {
  return (
    <div className="relative w-full h-44 flex items-center justify-center">
      {/* Drop zone mockup */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-72 h-32 rounded-2xl border-2 border-dashed border-[#1B7CFF]/50 bg-[#eef6ff] flex flex-col items-center justify-center gap-2 relative"
      >
        <motion.div
          animate={{ y: [-3, 3, -3] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Upload className="w-8 h-8 text-[#1B7CFF]" />
        </motion.div>
        <p className="text-xs font-medium text-[#4a6e97]">Drag & drop your video here</p>
        {/* Animated upload button */}
        <motion.div
          className="absolute -bottom-4 bg-[linear-gradient(120deg,#0047AB,#1B7CFF)] text-white text-xs font-semibold px-5 py-2 rounded-full shadow-lg"
          animate={{ boxShadow: ["0 4px 20px -4px rgba(0,71,171,0.5)", "0 8px 28px -4px rgba(0,71,171,0.8)", "0 4px 20px -4px rgba(0,71,171,0.5)"] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        >
          Click to upload
        </motion.div>
        {/* Click indicator on button */}
        <ClickIndicator className="-bottom-8 left-[calc(50%-1rem)]" />
      </motion.div>
    </div>
  );
}

function MarkIllustration() {
  const actions = ["SPIKE", "BLOCK", "ACE"];
  return (
    <div className="relative w-full h-44 flex items-center justify-center gap-4">
      {/* Mini video player */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="w-36 h-24 rounded-xl bg-gray-900 flex items-center justify-center relative overflow-hidden shadow-lg flex-shrink-0"
      >
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-[#1B7CFF]/20 to-transparent"
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <Play className="w-8 h-8 text-white/80" />
        {/* Progress bar */}
        <div className="absolute bottom-2 left-2 right-2 h-1 rounded-full bg-white/20">
          <motion.div
            className="h-full rounded-full bg-[#1B7CFF]"
            animate={{ width: ["20%", "65%"] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          />
        </div>
      </motion.div>

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-col gap-1.5 relative"
      >
        {actions.map((action, i) => (
          <motion.div
            key={action}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              i === 0
                ? "bg-[#0047AB] text-white border-[#0047AB] shadow-md"
                : "bg-white border-[#c7daf4] text-[#4a6e97]"
            }`}
            animate={i === 0 ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
          >
            <div className="flex items-center gap-1.5">
              <Tag className="w-3 h-3" />
              {action}
            </div>
          </motion.div>
        ))}
        {/* Click indicator on first button */}
        <ClickIndicator className="-top-2 -right-4" />
      </motion.div>
    </div>
  );
}

function GenerateIllustration() {
  return (
    <div className="relative w-full h-44 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative"
      >
        {/* Highlights list */}
        <div className="w-64 rounded-2xl bg-white border border-[#c7daf4] shadow-lg overflow-hidden">
          <div className="p-3 border-b border-[#e8f2ff] bg-[#f5f9ff]">
            <p className="text-xs font-semibold text-[#0f2d5c]">Your highlights</p>
          </div>
          {[
            { label: "SPIKE", time: "1:23" },
            { label: "ACE", time: "2:45" },
            { label: "BLOCK", time: "3:12" },
          ].map((h, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="flex items-center justify-between px-3 py-2 border-b border-[#f0f6ff] last:border-0"
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#1B7CFF]" />
                <span className="text-xs font-medium text-[#0f2d5c]">{h.label}</span>
              </div>
              <span className="text-xs text-[#6a86a8]">{h.time}</span>
            </motion.div>
          ))}
          {/* Generate button */}
          <div className="p-3 bg-[#f5f9ff] relative">
            <motion.div
              className="w-full bg-[linear-gradient(120deg,#0047AB,#1B7CFF)] text-white text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1.5"
              animate={{ boxShadow: ["0 4px 16px -4px rgba(0,71,171,0.4)", "0 6px 24px -4px rgba(0,71,171,0.7)", "0 4px 16px -4px rgba(0,71,171,0.4)"] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            >
              <Zap className="w-3 h-3" />
              Generate reel
            </motion.div>
            <ClickIndicator className="-top-2 left-1/2 -translate-x-1/2" />
          </div>
        </div>

        {/* Sparkle effects */}
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{
              top: `${[10, 70, 20, 80][i]}%`,
              left: `${[90, 95, -5, -8][i]}%`,
            }}
            animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5], rotate: [0, 180, 360] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }}
          >
            <Sparkles className="w-4 h-4 text-[#E8A550]" />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

function ShareIllustration() {
  return (
    <div className="relative w-full h-44 flex items-center justify-center gap-4">
      {/* Reel card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-28 h-36 rounded-xl bg-gray-900 relative overflow-hidden shadow-xl flex-shrink-0"
      >
        <motion.div
          className="absolute inset-0 bg-gradient-to-b from-[#1B7CFF]/30 to-transparent"
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Play className="w-8 h-8 text-white" />
          </motion.div>
        </div>
        <div className="absolute bottom-2 left-2 right-2">
          <div className="text-[9px] font-bold text-white/90">SPIKE @ 1:23</div>
        </div>
      </motion.div>

      {/* Share options */}
      <motion.div
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="flex flex-col gap-2"
      >
        {[
          { label: "Share profile", color: "bg-[#0047AB]", textColor: "text-white" },
          { label: "Make public", color: "bg-white", textColor: "text-[#0047AB]", border: "border border-[#c7daf4]" },
        ].map((btn, i) => (
          <motion.div
            key={i}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 ${btn.color} ${btn.textColor} ${btn.border ?? ""}`}
            animate={i === 0 ? { scale: [1, 1.04, 1] } : {}}
            transition={{ duration: 1.8, repeat: Infinity }}
          >
            <Share2 className="w-3 h-3" />
            {btn.label}
          </motion.div>
        ))}
        <ClickIndicator className="-top-3 right-0" />
      </motion.div>
    </div>
  );
}

const STEPS: Step[] = [
  {
    id: 0,
    chip: "Step 1 of 4",
    title: "Upload your match video",
    description:
      "Start by uploading your match footage. Drag and drop your video file onto the upload area, or click the button to browse. We support .mp4, .mov and .avi files up to 500MB.",

    illustration: <UploadIllustration />,
  },
  {
    id: 1,
    chip: "Step 2 of 4",
    title: "Mark your key moments",
    description:
      "Watch your footage in the video player. When you spot a great play (a spike, block, or ace) select the action type and click the mark button. We'll save the timestamp automatically.",
    illustration: <MarkIllustration />,
  },
  {
    id: 2,
    chip: "Step 3 of 4",
    title: "Generate your highlight reel",
    description:
      "Once you've tagged your moments, hit the Generate button. We'll stitch all your highlights into a single polished video. You can track the progress and have multiple reels per match.",
    illustration: <GenerateIllustration />,
  },
  {
    id: 3,
    chip: "Step 4 of 4",
    title: "Share and explore",
    description:
      "Make your reel public to share it with others. Head to the Explore page to discover reels from other players, follow them, and like their best moments.",
    illustration: <ShareIllustration />,
  },
];

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 60 : -60,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -60 : 60,
    opacity: 0,
  }),
};

export function OnboardingBanner() {
  const prefersReducedMotion = useReducedMotion();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      // Small delay so the dashboard renders first
      const t = setTimeout(() => setVisible(true), 400);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setDirection(1);
      setStep((s) => s + 1);
    } else {
      dismiss();
      router.push("/upload-page");
    }
  };

  const prev = () => {
    if (step > 0) {
      setDirection(-1);
      setStep((s) => s - 1);
    }
  };

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            onClick={dismiss}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 20 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="w-full max-w-lg rounded-3xl bg-white shadow-[0_32px_80px_-20px_rgba(0,37,92,0.35)] overflow-hidden pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Progress bar */}
              <div className="h-1 bg-[#e8f2ff]">
                <motion.div
                  className="h-full bg-[linear-gradient(90deg,#0047AB,#1B7CFF)]"
                  animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-5 pb-2">
                <div className="flex items-center gap-2">
                  {/* Step dots */}
                  {STEPS.map((_, i) => (
                    <motion.button
                      key={i}
                      onClick={() => {
                        setDirection(i > step ? 1 : -1);
                        setStep(i);
                      }}
                      animate={{
                        width: i === step ? 20 : 8,
                        backgroundColor: i === step ? "#0047AB" : i < step ? "#88BBFF" : "#dce8f8",
                      }}
                      transition={{ duration: 0.3 }}
                      className="h-2 rounded-full"
                    />
                  ))}
                </div>
                <button
                  onClick={dismiss}
                  className="rounded-full p-1.5 text-[#8aa4c4] hover:bg-[#e8f2ff] hover:text-[#0047AB] transition-colors"
                  aria-label="Skip onboarding"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Step content */}
              <div className="px-6 pb-6 overflow-hidden">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={step}
                    custom={direction}
                    variants={prefersReducedMotion ? {} : slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {/* Illustration */}
                    <div className="rounded-2xl bg-[linear-gradient(135deg,#eef6ff,#f0f4ff)] border border-[#dce8f8] mb-5 overflow-hidden">
                      {current.illustration}
                    </div>

                    {/* Text */}
                    <div className="mb-6">
                      <span className="chip-kicker mb-2 inline-block">{current.chip}</span>
                      <h2 className="text-xl font-semibold text-[#0f2d5c] leading-snug mb-2">
                        {current.title}
                      </h2>
                      <p className="text-sm text-[#4a6e97] leading-relaxed">
                        {current.description}
                      </p>
                    </div>

                    {/* Navigation */}
                    <div className="flex items-center justify-between">
                      <button
                        onClick={prev}
                        disabled={step === 0}
                        className="flex items-center gap-1.5 text-sm text-[#6a86a8] hover:text-[#0047AB] transition-colors disabled:opacity-0 disabled:pointer-events-none"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                      </button>

                      <div className="flex items-center gap-3">
                        {!isLast && (
                          <button
                            onClick={dismiss}
                            className="text-sm text-[#8aa4c4] hover:text-[#6a86a8] transition-colors"
                          >
                            Skip tour
                          </button>
                        )}
                        <Button onClick={next} className="h-10 px-5">
                          {isLast ? (
                            <>
                              Get started
                              <Sparkles className="w-4 h-4" />
                            </>
                          ) : (
                            <>
                              Next
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
