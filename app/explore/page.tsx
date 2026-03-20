"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SiteHeader } from "@/components/ui/site-header";
import { SiteFooter } from "@/components/ui/site-footer";
import { Button } from "@/components/ui/button";
import { ReelLikeButton } from "@/components/reel-like-button";
import Image from "next/image";
import Link from "next/link";
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
  Search,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

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

type SearchResult = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  team: string | null;
  position: string | null;
  public_reels: number;
  followers: number;
};

export default function ExplorePage() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();

  const [authed, setAuthed] = useState(false);
  const [reels, setReels] = useState<ExploreReel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedReelIds, setLikedReelIds] = useState<Set<string>>(new Set());

  // Feed state
  const [feedOpen, setFeedOpen] = useState(false);
  const [feedStartIndex, setFeedStartIndex] = useState(0);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchReels = useCallback(async (offset: number, append: boolean) => {
    const { data: reelData, error: reelErr } = await supabase
      .from("reel_jobs")
      .select("id, title, output_url, created_at, user_id")
      .eq("status", "complete")
      .eq("is_public", true)
      .eq("show_on_explore", true)
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

  useEffect(() => {
    const reelIds = reels.map((reel) => reel.id);
    if (reelIds.length === 0) {
      return;
    }

    let cancelled = false;

    const loadLikeSummary = async () => {
      try {
        const res = await fetch(
          `/api/reels/likes?ids=${encodeURIComponent(reelIds.join(","))}`,
        );

        if (!res.ok) return;

        const data = (await res.json()) as {
          counts?: Record<string, number>;
          likedIds?: string[];
        };

        if (cancelled) return;

        setLikeCounts(data.counts ?? {});
        setLikedReelIds(new Set(data.likedIds ?? []));
      } catch {
        if (!cancelled) {
          setLikeCounts({});
          setLikedReelIds(new Set());
        }
      }
    };

    loadLikeSummary();

    return () => {
      cancelled = true;
    };
  }, [reels]);

  const loadMore = async () => {
    setLoadingMore(true);
    await fetchReels(reels.length, true);
    setLoadingMore(false);
  };

  const openFeed = (index: number) => {
    setFeedStartIndex(index);
    setFeedOpen(true);
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (value.trim().length < 2) {
      setSearchResults([]);
      setSearchActive(false);
      setSearching(false);
      return;
    }

    setSearchActive(true);
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      const res = await fetch(
        `/api/users/search?q=${encodeURIComponent(value.trim())}`,
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results ?? []);
      } else {
        setSearchResults([]);
      }
      setSearching(false);
    }, 300);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSearchActive(false);
    setSearching(false);
  };

  // ── Loading state ──
  if (!authed || loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader showNav={true} activePage="explore" />
        <main className="page-shell flex-1">
          <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 pt-10 pb-12">
            <div className="flex items-center gap-3 mb-8">
              <div className="skeleton w-7 h-7 rounded-full" />
              <div className="space-y-2">
                <div className="skeleton h-6 w-32" />
                <div className="skeleton h-4 w-64" />
              </div>
            </div>
            <div className="skeleton h-12 w-full rounded-2xl mb-8" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl overflow-hidden border border-white/70 bg-white/50"
                >
                  <div className="skeleton aspect-[9/16]" />
                </div>
              ))}
            </div>
          </div>
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
    <div className="min-h-screen flex flex-col page-shell">
      <SiteHeader showNav={true} activePage="explore" />

      <main className="flex-1">
        {/* Page header */}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={prefersReducedMotion ? undefined : { duration: 0.32 }}
          className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 pt-8 md:pt-10 pb-4 md:pb-6"
        >
          <div className="flex items-center gap-3">
            <Compass className="w-7 h-7 text-[#0047AB]" />
            <div>
              <h1 className="text-2xl font-bold text-[#123f77]">Explore</h1>
              <p className="text-sm text-[#3d608d] mt-0.5">
                Discover recent public highlight reels from the community.
              </p>
            </div>
          </div>

          {/* Search bar */}
          <div className="mt-6 relative">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-[#0047AB]/20 via-[#1B7CFF]/20 to-[#E8A550]/20 rounded-2xl blur-sm group-focus-within:blur-md transition-all" />
              <div className="relative flex items-center bg-white/80 border border-white/70 backdrop-blur-lg rounded-2xl shadow-[0_18px_35px_-24px_rgba(0,71,171,0.95)] group-focus-within:shadow-[0_22px_38px_-20px_rgba(0,71,171,0.95)] group-focus-within:border-[#0047AB]/30 transition-all">
                <Search className="ml-4 w-5 h-5 text-[#4a6e97] group-focus-within:text-[#0047AB] transition-colors flex-shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search players by username or name..."
                  className="w-full py-3.5 px-3 bg-transparent text-sm text-[#183f71] placeholder:text-[#6a86a8] focus:outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={clearSearch}
                    className="mr-3 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Search results */}
            {searchActive && (
              <div className="mt-3">
                {searching ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center py-8">
                    <User className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">
                      No players found for &ldquo;{searchQuery}&rdquo;
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {searchResults.map((user, idx) => (
                      <motion.div
                        key={user.id}
                        initial={
                          prefersReducedMotion ? false : { opacity: 0, y: 12 }
                        }
                        animate={
                          prefersReducedMotion
                            ? undefined
                            : { opacity: 1, y: 0 }
                        }
                        transition={
                          prefersReducedMotion
                            ? undefined
                            : {
                                duration: 0.25,
                                delay: Math.min(idx * 0.04, 0.2),
                              }
                        }
                        whileHover={
                          prefersReducedMotion ? undefined : { y: -2 }
                        }
                      >
                        <Link
                          href={`/profile/${user.username}`}
                          className="flex items-center gap-3 p-3 border border-white/75 rounded-xl hover:shadow-md transition-shadow bg-white/76 backdrop-blur-md hover-border-glow"
                        >
                          <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-200 bg-gray-100 flex-shrink-0 flex items-center justify-center">
                            {user.avatar_url ? (
                              <Image
                                src={user.avatar_url}
                                alt={user.display_name || user.username}
                                width={48}
                                height={48}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-gray-400 text-sm font-medium">
                                {(user.display_name || user.username)
                                  .charAt(0)
                                  .toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {user.username}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {user.display_name}
                              {user.team ? ` · ${user.team}` : ""}
                            </p>
                            <div className="flex items-center gap-3 mt-0.5 text-[11px] text-gray-400">
                              <span>{user.public_reels} reels</span>
                              <span>{user.followers} followers</span>
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>

        <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 pb-12">
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
              <Button onClick={() => router.push("/profile")} className="mt-6">
                Go to your profile
              </Button>
            </div>
          ) : (
            <>
              {/* ─── Responsive grid ─── */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                {reels.map((reel, idx) => (
                  <ReelCard
                    key={reel.id}
                    reel={reel}
                    index={idx}
                    onClick={() => openFeed(idx)}
                    likeCount={likeCounts[reel.id] ?? 0}
                    isLiked={likedReelIds.has(reel.id)}
                    onLikeChange={(nextLiked, nextCount) => {
                      setLikeCounts((prev) => ({
                        ...prev,
                        [reel.id]: nextCount,
                      }));
                      setLikedReelIds((prev) => {
                        const next = new Set(prev);
                        if (nextLiked) {
                          next.add(reel.id);
                        } else {
                          next.delete(reel.id);
                        }
                        return next;
                      });
                    }}
                  />
                ))}
              </div>

              {hasMore && (
                <div className="flex justify-center mt-8">
                  <Button
                    onClick={loadMore}
                    disabled={loadingMore}
                    variant="outline"
                    className="border-[#8cb2e0] text-[#18467f] hover:bg-[#e8f2ff] px-8"
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
  index,
  onClick,
  likeCount,
  isLiked,
  onLikeChange,
}: {
  reel: ExploreReel;
  index: number;
  onClick: () => void;
  likeCount: number;
  isLiked: boolean;
  onLikeChange: (liked: boolean, count: number) => void;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className="group relative rounded-2xl overflow-hidden border border-white/75 bg-white/75 backdrop-blur-lg hover:shadow-[0_20px_38px_-24px_rgba(0,71,171,0.95)] transition-shadow text-left w-full hover-border-glow cursor-pointer"
      initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
      whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={
        prefersReducedMotion
          ? undefined
          : {
              duration: 0.35,
              delay: Math.min(index * 0.05, 0.3),
              ease: [0.22, 1, 0.36, 1],
            }
      }
      whileHover={prefersReducedMotion ? undefined : { y: -6, scale: 1.02 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
    >
      {/* Thumbnail — 9:16 aspect on mobile, 9:16 everywhere for TikTok feel */}
      <div className="aspect-[9/16] bg-[#dce7f6] relative overflow-hidden">
        <div className="absolute top-2 right-2 z-10">
          <ReelLikeButton
            reelId={reel.id}
            initialCount={likeCount}
            initialLiked={isLiked}
            onLikeChange={onLikeChange}
          />
        </div>

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
    </motion.div>
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
