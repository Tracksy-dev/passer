"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, CheckCheck, Heart, UserRound, Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/ui/site-header";
import { SiteFooter } from "@/components/ui/site-footer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type NotificationType = "reel_liked" | "followed_you";

type NotificationRow = {
  id: string;
  type: NotificationType;
  reel_id: string | null;
  read_at: string | null;
  created_at: string;
  actor: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  reel: {
    id: string;
    title: string | null;
    output_url: string | null;
  } | null;
};

export default function NotificationsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    const res = await fetch("/api/notifications?limit=50", {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error("Failed to load notifications");
    }

    const data = (await res.json()) as {
      notifications?: NotificationRow[];
      unreadCount?: number;
    };

    setNotifications(data.notifications ?? []);
    setUnreadCount(data.unreadCount ?? 0);
  }, []);

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login?redirectTo=/notifications");
        return;
      }

      try {
        await loadNotifications();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not load notifications";
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [loadNotifications, router]);

  const unreadItems = useMemo(
    () => notifications.filter((item) => !item.read_at).length,
    [notifications],
  );

  const markAsRead = async (id: string) => {
    setMarkingId(id);

    const previous = notifications;
    const nowIso = new Date().toISOString();

    setNotifications((prev) =>
      prev.map((item) =>
        item.id === id && !item.read_at ? { ...item, read_at: nowIso } : item,
      ),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      const res = await fetch(`/api/notifications/${id}`, { method: "PATCH" });
      if (!res.ok) {
        throw new Error("Failed to mark notification as read");
      }
    } catch (error) {
      setNotifications(previous);
      setUnreadCount(previous.filter((item) => !item.read_at).length);
      const message =
        error instanceof Error
          ? error.message
          : "Could not update notification";
      toast.error(message);
    } finally {
      setMarkingId(null);
    }
  };

  const markAllAsRead = async () => {
    if (unreadItems === 0) return;

    setMarkingAll(true);

    const previous = notifications;
    const nowIso = new Date().toISOString();

    setNotifications((prev) =>
      prev.map((item) => (item.read_at ? item : { ...item, read_at: nowIso })),
    );
    setUnreadCount(0);

    try {
      const res = await fetch("/api/notifications/read-all", {
        method: "PATCH",
      });
      if (!res.ok) {
        throw new Error("Failed to mark all notifications as read");
      }
    } catch (error) {
      setNotifications(previous);
      setUnreadCount(previous.filter((item) => !item.read_at).length);
      const message =
        error instanceof Error
          ? error.message
          : "Could not update notifications";
      toast.error(message);
    } finally {
      setMarkingAll(false);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-white/70 bg-white/70 p-4 backdrop-blur-md"
            >
              <div className="skeleton h-4 w-1/3 mb-3" />
              <div className="skeleton h-3 w-2/3" />
            </div>
          ))}
        </div>
      );
    }

    if (notifications.length === 0) {
      return (
        <div className="rounded-2xl border border-white/70 bg-white/70 p-10 text-center backdrop-blur-md">
          <Bell className="w-10 h-10 mx-auto text-[#7f9fc3]" />
          <h2 className="mt-3 text-lg font-semibold text-[#163f73]">
            No notifications yet
          </h2>
          <p className="mt-1 text-sm text-[#4f6f96]">
            Likes and follows will appear here.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {notifications.map((item) => {
          const actorName =
            item.actor?.display_name || item.actor?.username || "Someone";
          const actorUsername = item.actor?.username;

          const itemText =
            item.type === "reel_liked"
              ? `${actorName} liked your reel${item.reel?.title ? `: ${item.reel.title}` : ""}`
              : `${actorName} started following you`;

          return (
            <div
              key={item.id}
              className={`rounded-xl border p-4 backdrop-blur-md transition-colors ${
                item.read_at
                  ? "border-white/60 bg-white/60"
                  : "border-[#9bc2ef] bg-[#eef6ff]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5">
                    {item.type === "reel_liked" ? (
                      <div className="w-9 h-9 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center">
                        <Heart className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-[#0047AB]/10 text-[#0047AB] flex items-center justify-center">
                        <UserRound className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#173f72] break-words">
                      {itemText}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-[#6d89ab]">
                      <span>
                        {new Date(item.created_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                      {actorUsername ? (
                        <Link
                          href={`/profile/${actorUsername}`}
                          className="underline-offset-2 hover:underline"
                        >
                          View profile
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {item.type === "reel_liked" && item.reel?.output_url ? (
                    <Link
                      href={`/profile?reel=${item.reel.id}`}
                      className="block w-10 h-14 rounded-lg overflow-hidden bg-[#dce7f6] flex-shrink-0 ring-1 ring-black/10 hover:ring-[#0047AB]/40 transition-all hover:scale-105"
                      title={item.reel.title || "View reel"}
                    >
                      <video
                        src={item.reel.output_url}
                        className="w-full h-full object-cover pointer-events-none"
                        muted
                        preload="metadata"
                      />
                    </Link>
                  ) : null}
                  {!item.read_at ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 text-xs"
                      onClick={() => markAsRead(item.id)}
                      disabled={markingId === item.id}
                    >
                      {markingId === item.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        "Mark read"
                      )}
                    </Button>
                  ) : (
                    <span className="text-[11px] font-medium text-[#6d89ab]">
                      Read
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader showNav={true} activePage="notifications" />

      <main className="page-shell flex-1 px-4 md:px-6 lg:px-8 py-8 md:py-10">
        <div className="max-w-4xl mx-auto">
          <div className="glass-surface p-5 md:p-6 mb-4 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-semibold text-[#163f73]">
                Notifications
              </h1>
              <p className="text-sm text-[#4f6f96] mt-1">
                {unreadCount > 0
                  ? `${unreadCount} unread`
                  : "You are all caught up"}
              </p>
            </div>
            <Button
              variant="outline"
              className="h-9"
              onClick={markAllAsRead}
              disabled={markingAll || unreadItems === 0}
            >
              {markingAll ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CheckCheck className="w-4 h-4 mr-1.5" />
                  Mark all read
                </>
              )}
            </Button>
          </div>

          {renderContent()}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
