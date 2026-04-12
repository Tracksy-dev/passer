"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Star, MessageSquare, Users, TrendingUp, Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/ui/site-header";
import { SiteFooter } from "@/components/ui/site-footer";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type FeedbackItem = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  user_name: string;
};

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(
            "w-3.5 h-3.5",
            s <= rating ? "fill-[#E8A550] text-[#E8A550]" : "fill-transparent text-[#c5d6ec]",
          )}
        />
      ))}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/admin/feedback");
      if (res.status === 401) {
        router.push("/login?redirectTo=/admin");
        return;
      }
      if (res.status === 403) {
        setForbidden(true);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setFeedback(data.feedback ?? []);
      setLoading(false);
    };
    load();
  }, [router]);

  const avgRating =
    feedback.length > 0
      ? (feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length).toFixed(1)
      : null;

  const withComments = feedback.filter((f) => f.comment).length;

  const ratingCounts = [5, 4, 3, 2, 1].map((r) => ({
    rating: r,
    count: feedback.filter((f) => f.rating === r).length,
  }));

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader showNav={true} />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#0047AB]" />
        </main>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader showNav={true} />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-2xl font-semibold text-[#0f2d5c]">Access Denied</p>
            <p className="text-[#6a86a8] text-sm">You don't have permission to view this page.</p>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader showNav={true} />

      <main className="page-shell flex-1 px-4 md:px-6 lg:px-8 py-8 md:py-10">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="text-2xl md:text-3xl font-semibold text-[#0f2d5c]">
              Feedback Dashboard
            </h1>
            <p className="text-sm text-[#6a86a8] mt-1">
              All user feedback submissions from the in-app form.
            </p>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-2 md:grid-cols-3 gap-4"
          >
            <div className="glass-surface p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#0047AB]/10 flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-[#0047AB]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#0f2d5c]">{feedback.length}</p>
                <p className="text-xs text-[#6a86a8]">Total responses</p>
              </div>
            </div>

            <div className="glass-surface p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#E8A550]/15 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-[#E8A550]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#0f2d5c]">{avgRating ?? "—"}</p>
                <p className="text-xs text-[#6a86a8]">Average rating</p>
              </div>
            </div>

            <div className="glass-surface p-5 flex items-center gap-4 col-span-2 md:col-span-1">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#0f2d5c]">{withComments}</p>
                <p className="text-xs text-[#6a86a8]">With comments</p>
              </div>
            </div>
          </motion.div>

          {/* Rating breakdown */}
          {feedback.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="glass-surface p-5"
            >
              <h2 className="text-sm font-semibold text-[#0f2d5c] mb-4">Rating breakdown</h2>
              <div className="space-y-2">
                {ratingCounts.map(({ rating, count }) => (
                  <div key={rating} className="flex items-center gap-3">
                    <div className="flex items-center gap-1 w-24 flex-shrink-0">
                      <StarDisplay rating={rating} />
                    </div>
                    <div className="flex-1 h-2 rounded-full bg-[#e8f2ff] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#0047AB,#1B7CFF)]"
                        style={{
                          width: feedback.length > 0 ? `${(count / feedback.length) * 100}%` : "0%",
                          transition: "width 0.6s ease",
                        }}
                      />
                    </div>
                    <span className="text-xs text-[#6a86a8] w-6 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Feedback list */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-3"
          >
            <h2 className="text-sm font-semibold text-[#0f2d5c]">All submissions</h2>

            {feedback.length === 0 ? (
              <div className="glass-surface p-10 text-center">
                <MessageSquare className="w-8 h-8 mx-auto text-[#9bc2ef] mb-2" />
                <p className="text-sm text-[#6a86a8]">No feedback submitted yet.</p>
              </div>
            ) : (
              feedback.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: idx * 0.03, ease: [0.22, 1, 0.36, 1] }}
                  className="rounded-xl border border-white/60 bg-white/70 backdrop-blur-md p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StarDisplay rating={item.rating} />
                        <span className="text-[11px] font-semibold text-[#E8A550]">
                          {["", "Poor", "Fair", "Good", "Great", "Excellent"][item.rating]}
                        </span>
                      </div>
                      {item.comment ? (
                        <p className="text-sm text-[#1a3a6c] leading-relaxed">
                          {item.comment}
                        </p>
                      ) : (
                        <p className="text-sm text-[#99b5d4] italic">No comment left.</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 space-y-0.5">
                      <p className="text-xs font-medium text-[#4a6e97]">{item.user_name}</p>
                      <p className="text-[11px] text-[#99b5d4]">
                        {new Date(item.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
