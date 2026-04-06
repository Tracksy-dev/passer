"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { MessageSquarePlus, X, Star, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FeedbackButton() {
  const prefersReducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const reset = () => {
    setRating(0);
    setHovered(0);
    setComment("");
    setDone(false);
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(reset, 300);
  };

  const handleSubmit = async () => {
    if (!rating) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      });

      if (!res.ok) throw new Error("Failed");
      setDone(true);
      setTimeout(() => {
        handleClose();
      }, 2200);
    } catch {
      // silently fail — don't block the user
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      <motion.button
        onClick={() => setOpen(true)}
        whileHover={prefersReducedMotion ? undefined : { scale: 1.05, y: -2 }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-[linear-gradient(120deg,#0047AB,#1B7CFF)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_30px_-12px_rgba(0,71,171,0.7)] hover:shadow-[0_20px_36px_-10px_rgba(0,71,171,0.8)] transition-shadow"
        aria-label="Give feedback"
      >
        <MessageSquarePlus className="w-4 h-4" />
        Feedback
      </motion.button>

      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px]"
            onClick={handleClose}
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.97 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-20 right-6 z-50 w-[22rem] max-w-[calc(100vw-3rem)] rounded-2xl border border-white/70 bg-white/95 p-5 shadow-[0_24px_50px_-20px_rgba(0,37,92,0.3)] backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[15px] font-semibold text-[#0f2d5c]">
                  Share your feedback
                </h3>
                <p className="text-xs text-[#6a86a8] mt-0.5">
                  How is your experience with Passer?
                </p>
              </div>
              <button
                onClick={handleClose}
                className="rounded-full p-1.5 text-[#8aa4c4] hover:bg-[#e8f2ff] hover:text-[#0047AB] transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <AnimatePresence mode="wait">
              {done ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-2 py-6 text-center"
                >
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                  <p className="text-sm font-semibold text-[#0f2d5c]">
                    Thanks for your feedback!
                  </p>
                  <p className="text-xs text-[#6a86a8]">
                    We really appreciate you taking the time.
                  </p>
                </motion.div>
              ) : (
                <motion.div key="form" exit={{ opacity: 0 }}>
                  {/* Star rating */}
                  <div className="mb-4">
                    <p className="text-xs font-medium text-[#4a6e97] mb-2">
                      Rate your experience
                    </p>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHovered(star)}
                          onMouseLeave={() => setHovered(0)}
                          className="transition-transform hover:scale-110 active:scale-95"
                          aria-label={`Rate ${star} out of 5`}
                        >
                          <Star
                            className={cn(
                              "w-8 h-8 transition-colors",
                              star <= (hovered || rating)
                                ? "fill-[#E8A550] text-[#E8A550]"
                                : "fill-transparent text-[#c5d6ec]",
                            )}
                          />
                        </button>
                      ))}
                    </div>
                    {rating > 0 && (
                      <p className="text-xs text-[#6a86a8] mt-1">
                        {["", "Poor", "Fair", "Good", "Great", "Excellent!"][rating]}
                      </p>
                    )}
                  </div>

                  {/* Comment */}
                  <div className="mb-4">
                    <p className="text-xs font-medium text-[#4a6e97] mb-2">
                      Any thoughts? (optional)
                    </p>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Tell us what you think..."
                      rows={3}
                      maxLength={500}
                      className="w-full rounded-lg border border-[#c7daf4] bg-white/80 px-3 py-2 text-sm text-[#1a3a6c] placeholder:text-[#99b5d4] focus:outline-none focus:border-[#1B7CFF]/60 focus:ring-2 focus:ring-[#1B7CFF]/20 resize-none transition-colors"
                    />
                    <p className="text-[10px] text-[#99b5d4] text-right mt-0.5">
                      {comment.length}/500
                    </p>
                  </div>

                  {/* Submit */}
                  <Button
                    onClick={handleSubmit}
                    disabled={!rating || submitting}
                    className="w-full h-10"
                  >
                    {submitting ? (
                      "Sending..."
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Submit feedback
                      </>
                    )}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
