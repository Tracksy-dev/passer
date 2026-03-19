"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

type ProfileFollowButtonProps = {
  profileUserId: string;
  profileUsername: string;
};

export function ProfileFollowButton({
  profileUserId,
  profileUsername,
}: ProfileFollowButtonProps) {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function loadFollowState() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (isCancelled) return;

      if (!user) {
        setIsAuthenticated(false);
        setIsReady(true);
        return;
      }

      setIsAuthenticated(true);

      if (user.id === profileUserId) {
        setIsOwnProfile(true);
        setIsReady(true);
        return;
      }

      const { data } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", profileUserId)
        .maybeSingle();

      if (isCancelled) return;

      setIsFollowing(!!data);
      setIsReady(true);
    }

    loadFollowState();

    return () => {
      isCancelled = true;
    };
  }, [profileUserId]);

  async function handleToggleFollow() {
    setIsSubmitting(true);

    const nextFollowingState = !isFollowing;
    setIsFollowing(nextFollowingState);

    const res = await fetch("/api/follows", {
      method: isFollowing ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ following_id: profileUserId }),
    });

    if (!res.ok) {
      setIsFollowing(!nextFollowingState);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    router.refresh();
  }

  if (!isReady || isOwnProfile) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <Button
        asChild
        size="sm"
        variant="outline"
        className="bg-white text-gray-900 hover:bg-gray-50"
      >
        <Link href={`/login?next=/profile/${profileUsername}`}>Follow</Link>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="bg-white text-gray-900 hover:bg-gray-50"
      disabled={isSubmitting}
      onClick={handleToggleFollow}
    >
      {isSubmitting ? "Updating..." : isFollowing ? "Unfollow" : "Follow"}
    </Button>
  );
}
