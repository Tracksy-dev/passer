"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

type ReelLikeButtonProps = {
  reelId: string;
  initialCount: number;
  initialLiked: boolean;
  className?: string;
  onLikeChange?: (liked: boolean, count: number) => void;
};

export function ReelLikeButton({
  reelId,
  initialCount,
  initialLiked,
  className,
  onLikeChange,
}: ReelLikeButtonProps) {
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initialLiked);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    setLiked(initialLiked);
  }, [initialLiked]);

  const handleToggle = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (submitting) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      const redirectTo =
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : "/explore";
      router.push(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
      return;
    }

    setSubmitting(true);

    const nextLiked = !liked;
    const nextCount = Math.max(0, count + (nextLiked ? 1 : -1));

    setLiked(nextLiked);
    setCount(nextCount);
    onLikeChange?.(nextLiked, nextCount);

    try {
      const res = await fetch(`/api/reels/${reelId}/likes`, {
        method: liked ? "DELETE" : "POST",
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body.error ?? "Failed to update like");
      }

      const safeCount =
        typeof body.count === "number" ? Math.max(0, body.count) : nextCount;
      const safeLiked =
        typeof body.liked === "boolean" ? body.liked : nextLiked;

      setLiked(safeLiked);
      setCount(safeCount);
      onLikeChange?.(safeLiked, safeCount);
    } catch (error) {
      setLiked(liked);
      setCount(count);
      onLikeChange?.(liked, count);
      const message =
        error instanceof Error ? error.message : "Could not update like";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={submitting}
      aria-label={liked ? "Unlike reel" : "Like reel"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        liked
          ? "border-rose-300 bg-rose-500/80 text-white"
          : "border-white/35 bg-black/40 text-white/90 hover:bg-black/60",
        submitting && "opacity-70",
        className,
      )}
    >
      <Heart
        className={cn("w-3.5 h-3.5", liked && "fill-current")}
        strokeWidth={2}
      />
      <span>{count}</span>
    </button>
  );
}
