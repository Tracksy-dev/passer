"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SiteHeader } from "@/components/ui/site-header";
import { SiteFooter } from "@/components/ui/site-footer";
import { Button } from "@/components/ui/button";
import {
  Compass,
  Film,
  Play,
  X,
  Loader2,
  User,
  ChevronUp,
  ChevronDown,
  Volume2,
  VolumeX,
} from "lucide-react";

const PAGE_SIZE = 12;

type ExploreReel = {
  id: string;
  title: string | null;
  output_url: string | null;
  created_at: string;
  user_id: string;
  creator: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
};

export default function ExplorePage() {
  const router = useRouter();

  const [authed, setAuthed] = useState(false);
  const [reels, setReels] = useState<ExploreReel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Feed state
  const [feedOpen, setFeedOpen] = useState(false);
  const [feedStartIndex, setFeedStartIndex] = useState(0);

  const fetchReels = useCallback(async (offset: number, append: boolean) => {
    const { data: reelData, error: reelErr } = await supabase
      .from("reel_jobs")
      .select("id, title, output_url, created_at, user_id")
      .eq("status", "complete")
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (reelErr) {
      console.error("Failed to load explore reels:", reelErr);
      return;
    }

    const rows = reelData ?? [];
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const creatorMap = new Map<
      string,
      { username: string; display_name: string; avatar_url: string | null }
    >();

    if (userIds.length > 0) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", userIds);

      for (const p of profileData ?? []) {
        creatorMap.set(p.id, {
          username: p.username ?? "",
          display_name: p.display_name ?? "",
          avatar_url: null,
        });
      }
    }

    const mapped: ExploreReel[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      output_url: row.output_url,
      created_at: row.created_at,
      user_id: row.user_id,
      creator: creatorMap.get(row.user_id) ?? null,
    }));

    if (append) {
      setReels((prev) => [...prev, ...mapped]);
    } else {
      setReels(mapped);
    }
    setHasMore(rows.length === PAGE_SIZE);
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) {
        router.push("/login");
        return;
      }
      setAuthed(true);
      await fetchReels(0, false);
      setLoading(false);
    };
    init();
  }, [router, fetchReels]);

  const loadMore = async () => {
    setLoadingMore(true);
    await fetchReels(reels.length, true);
    setLoadingMore(false);
  };

  const openFeed = (index: number) => {
    setFeedStartIndex(index);
    setFeedOpen(true);
  };

  // ── Loading state ──
  if (!authed || loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader showNav={true} activePage="explore" />
        <main className="flex-1 bg-white flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </main>
        <SiteFooter />
      </div>
    );
  }

  // ── Full-screen TikTok feed ──
  if (feedOpen) {
    return (
      <ReelFeed
        reels={reels}
        startIndex={feedStartIndex}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onClose={() => setFeedOpen(false)}
      />
    );
  }

  // ── Grid browse view ──
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SiteHeader showNav={true} activePage="explore" />

      <main className="flex-1">
        {/* Page header */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10 pb-4 sm:pb-6">
          <div className="flex items-center gap-3">
            <Compass className="w-7 h-7 text-[#0047AB]" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Explore</h1>
              <p className="text-sm text-gray-600 mt-0.5">
                Discover recent public highlight reels from the community.
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
          {reels.length === 0 ? (
            /* ─── Empty state ─── */
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-20 h-20 rounded-full border-2 border-gray-300 flex items-center justify-center mb-4">
                <Film className="w-10 h-10 text-gray-300" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                No public reels yet
              </h3>
              <p className="text-sm text-gray-500 max-w-sm">
                When players share their highlight reels publicly, they&apos;ll
                appear here. Be the first — set a reel to public from your
                profile!
              </p>
              <Button
                onClick={() => router.push("/profile")}
                className="mt-6 bg-[#0047AB] hover:bg-[#003580] text-white"
              >
                Go to your profile
              </Button>
            </div>
          ) : (
            <>
              {/* ─── Responsive grid ─── */}
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {reels.map((reel, idx) => (
                  <ReelCard
                    key={reel.id}
                    reel={reel}
                    onClick={() => openFeed(idx)}
                  />
                ))}
              </div>

              {hasMore && (
                <div className="flex justify-center mt-8">
                  <Button
                    onClick={loadMore}
                    disabled={loadingMore}
                    variant="outline"
                    className="border-gray-300 text-gray-700 hover:bg-gray-100 px-8"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Load more"
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Grid Card
   ═══════════════════════════════════════════════════ */

function ReelCard({
  reel,
  onClick,
}: {
  reel: ExploreReel;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative rounded-xl overflow-hidden border border-gray-200 bg-white hover:shadow-md transition-shadow text-left w-full"
    >
      {/* Thumbnail — 9:16 aspect on mobile, 9:16 everywhere for TikTok feel */}
      <div className="aspect-[9/16] bg-gray-100 relative overflow-hidden">
        {reel.output_url ? (
          <video
            src={reel.output_url}
            className="w-full h-full object-cover"
            muted
            preload="metadata"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film className="w-10 h-10 text-gray-300" />
          </div>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
            <Play className="w-5 h-5 text-gray-900 ml-0.5 fill-gray-900" />
          </div>
        </div>

        {/* Bottom gradient + info overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-3 pt-10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
              <User className="w-3.5 h-3.5 text-gray-300" />
            </div>
            <span className="text-white text-xs font-medium truncate">
              {reel.creator?.display_name ||
                reel.creator?.username ||
                "Unknown"}
            </span>
          </div>
          <p className="text-white/80 text-xs mt-1 truncate">
            {reel.title || "Highlight Reel"}
          </p>
        </div>
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════
   Full-screen TikTok-style Feed
   ═══════════════════════════════════════════════════ */

function ReelFeed({
  reels,
  startIndex,
  hasMore,
  onLoadMore,
  onClose,
}: {
  reels: ExploreReel[];
  startIndex: number;
  hasMore: boolean;
  onLoadMore: () => Promise<void>;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(startIndex);
  const [muted, setMuted] = useState(true);
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());
  const isScrollingRef = useRef(false);

  // Scroll to start index on mount
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const target = el.children[startIndex] as HTMLElement | undefined;
    if (target) {
      target.scrollIntoView({ behavior: "instant" });
    }
  }, [startIndex]);

  // Observe which slide is in view
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const idx = Number((entry.target as HTMLElement).dataset.index);
            if (!isNaN(idx)) {
              setActiveIndex(idx);
            }
          }
        }
      },
      { root: el, threshold: 0.6 },
    );

    for (const child of Array.from(el.children)) {
      observer.observe(child);
    }

    return () => observer.disconnect();
  }, [reels.length]);

  // Play/pause videos based on active index
  useEffect(() => {
    videoRefs.current.forEach((video, idx) => {
      if (idx === activeIndex) {
        video.currentTime = 0;
        video.muted = muted;
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, [activeIndex, muted]);

  // Load more when near the end
  useEffect(() => {
    if (activeIndex >= reels.length - 3 && hasMore) {
      onLoadMore();
    }
  }, [activeIndex, reels.length, hasMore, onLoadMore]);

  const scrollToIndex = useCallback((idx: number) => {
    const el = containerRef.current;
    if (!el) return;
    const target = el.children[idx] as HTMLElement | undefined;
    if (target) {
      isScrollingRef.current = true;
      target.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 500);
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        scrollToIndex(Math.min(activeIndex + 1, reels.length - 1));
      }
      if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        scrollToIndex(Math.max(activeIndex - 1, 0));
      }
      if (e.key === "m") {
        setMuted((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeIndex, reels.length, onClose, scrollToIndex]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors"
          aria-label="Close feed"
        >
          <X className="w-5 h-5 text-white" />
        </button>
        <span className="text-white/70 text-sm font-medium">
          {activeIndex + 1} / {reels.length}
        </span>
        <button
          onClick={() => setMuted((m) => !m)}
          className="w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? (
            <VolumeX className="w-5 h-5 text-white" />
          ) : (
            <Volume2 className="w-5 h-5 text-white" />
          )}
        </button>
      </div>

      {/* Nav arrows — desktop only */}
      <div className="hidden md:flex absolute right-6 top-1/2 -translate-y-1/2 z-20 flex-col gap-2">
        <button
          onClick={() => scrollToIndex(Math.max(activeIndex - 1, 0))}
          disabled={activeIndex === 0}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center transition-colors"
          aria-label="Previous reel"
        >
          <ChevronUp className="w-5 h-5 text-white" />
        </button>
        <button
          onClick={() =>
            scrollToIndex(Math.min(activeIndex + 1, reels.length - 1))
          }
          disabled={activeIndex === reels.length - 1}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center transition-colors"
          aria-label="Next reel"
        >
          <ChevronDown className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Scrollable feed container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {reels.map((r, idx) => (
          <div
            key={r.id}
            data-index={idx}
            className="h-full w-full snap-start snap-always relative flex items-center justify-center"
          >
            {/* Video */}
            {r.output_url ? (
              <video
                ref={(el) => {
                  if (el) videoRefs.current.set(idx, el);
                  else videoRefs.current.delete(idx);
                }}
                src={r.output_url}
                className="h-full w-full object-contain"
                loop
                playsInline
                muted={muted}
                preload={Math.abs(idx - activeIndex) <= 1 ? "auto" : "none"}
                onClick={() => {
                  const v = videoRefs.current.get(idx);
                  if (v) {
                    if (v.paused) v.play().catch(() => {});
                    else v.pause();
                  }
                }}
              />
            ) : (
              <div className="flex items-center justify-center">
                <Film className="w-16 h-16 text-gray-600" />
              </div>
            )}

            {/* Bottom overlay — creator info */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-4 pb-6 sm:p-6 sm:pb-8">
              {/* Creator row */}
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-gray-600 border-2 border-white/30 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-gray-300" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold truncate">
                    {r.creator?.display_name ||
                      r.creator?.username ||
                      "Unknown"}
                  </p>
                  {r.creator?.username && (
                    <p className="text-white/60 text-xs truncate">
                      @{r.creator.username}
                    </p>
                  )}
                </div>
              </div>
              {/* Title + date */}
              <p className="text-white text-sm font-medium truncate">
                {r.title || "Highlight Reel"}
              </p>
              <p className="text-white/50 text-xs mt-1">
                {new Date(r.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Hide scrollbar */}
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
