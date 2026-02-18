"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2, Eye, EyeOff } from "lucide-react";

type ReelJobStatus = "queued" | "processing" | "complete" | "failed";

type ReelJobRow = {
  id: string;
  match_id: string;
  user_id: string;
  status: ReelJobStatus;
  clip_before: number;
  clip_after: number;
  output_path: string | null;
  output_url: string | null;
  error: string | null;
  created_at: string;
  title?: string | null;
  is_public: boolean;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString();
}

export function HighlightReelPanel({ matchId }: { matchId: string }) {
  const [reels, setReels] = useState<ReelJobRow[]>([]);
  const [selectedReelId, setSelectedReelId] = useState<string | null>(null);

  const [isStarting, setIsStarting] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [isTogglingId, setIsTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => reels.find((r) => r.id === selectedReelId) ?? null,
    [reels, selectedReelId],
  );

  const loadReels = async () => {
    const { data, error } = await supabase
      .from("reel_jobs")
      .select(
        "id, match_id, user_id, status, clip_before, clip_after, output_path, output_url, error, created_at, title, is_public",
      )
      .eq("match_id", matchId)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      return;
    }

    const rows = (data ?? []) as ReelJobRow[];
    setReels(rows);

    // Keep selection stable / sensible
    setSelectedReelId((prev) => {
      if (prev && rows.some((r) => r.id === prev)) return prev;
      return rows[0]?.id ?? null;
    });
  };

  useEffect(() => {
    loadReels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  // Poll any queued/processing reels
  useEffect(() => {
    const hasActive = reels.some(
      (r) => r.status === "queued" || r.status === "processing",
    );
    if (!hasActive) return;

    const interval = window.setInterval(() => {
      loadReels();
    }, 2000);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reels]);

  const startNewReel = async () => {
    try {
      setIsStarting(true);
      setError(null);

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr) throw userErr;
      if (!user) throw new Error("You must be logged in.");

      const { count, error: cntErr } = await supabase
        .from("match_points")
        .select("*", { count: "exact", head: true })
        .eq("match_id", matchId);

      if (cntErr) throw cntErr;
      if (!count || count < 1)
        throw new Error("Add at least one highlight first.");

      const { data: inserted, error: insErr } = await supabase
        .from("reel_jobs")
        .insert({
          match_id: matchId,
          user_id: user.id,
          status: "queued",
          clip_before: 6,
          clip_after: 6,
          title: null,
        })
        .select("id")
        .single();

      if (insErr) throw insErr;

      await loadReels();
      if (inserted?.id) setSelectedReelId(inserted.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create reel job");
    } finally {
      setIsStarting(false);
    }
  };

  const deleteReel = async (reelJobId: string) => {
    try {
      setIsDeletingId(reelJobId);
      setError(null);

      const { data: job, error: jobErr } = await supabase
        .from("reel_jobs")
        .select("id, output_path")
        .eq("id", reelJobId)
        .single();

      if (jobErr) throw jobErr;

      if (job.output_path) {
        const { error: storageErr } = await supabase.storage
          .from("highlight-reels")
          .remove([job.output_path]);

        if (storageErr) throw storageErr;
      }

      const { error: dbErr } = await supabase
        .from("reel_jobs")
        .delete()
        .eq("id", reelJobId);

      if (dbErr) throw dbErr;

      await loadReels();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to delete reel");
    } finally {
      setIsDeletingId(null);
    }
  };

  const togglePrivacy = async (reelJobId: string, currentlyPublic: boolean) => {
    try {
      setIsTogglingId(reelJobId);
      setError(null);

      const { error: updateErr } = await supabase
        .from("reel_jobs")
        .update({ is_public: !currentlyPublic })
        .eq("id", reelJobId);

      if (updateErr) throw updateErr;

      // Update local state immediately
      setReels((prev) =>
        prev.map((r) =>
          r.id === reelJobId ? { ...r, is_public: !currentlyPublic } : r,
        ),
      );
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to update privacy");
    } finally {
      setIsTogglingId(null);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900">
          Highlight Reels
        </span>
        <Button
          onClick={startNewReel}
          disabled={isStarting}
          className="h-8 px-3 bg-[#0047AB] hover:bg-[#003580] text-white"
        >
          {isStarting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating…
            </>
          ) : (
            "Generate new"
          )}
        </Button>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-50 border-b border-red-200">
          {error}
        </div>
      )}

      <div className="p-4 border-b border-gray-200">
        {selected?.output_url ? (
          <video
            controls
            className="w-full rounded-lg border border-gray-200 bg-black"
            src={selected.output_url}
          />
        ) : (
          <div className="text-sm text-gray-600">
            {selected
              ? selected.status === "failed"
                ? `Failed: ${selected.error ?? "Unknown error"}`
                : `Status: ${selected.status}`
              : "No reels yet. Generate your first one!"}
          </div>
        )}
      </div>

      <div className="max-h-64 overflow-y-auto">
        {reels.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">No reels created yet.</div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {reels.map((r) => {
              const active = r.id === selectedReelId;
              const disableDelete =
                isDeletingId === r.id ||
                r.status === "queued" ||
                r.status === "processing";
              const isCompleted = r.status === "complete";

              return (
                <li
                  key={r.id}
                  className={`p-4 flex items-start justify-between gap-3 ${
                    active ? "bg-blue-50" : "hover:bg-gray-50"
                  }`}
                >
                  <button
                    type="button"
                    className="flex-1 text-left"
                    onClick={() => setSelectedReelId(r.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">
                        {r.title?.trim() ? r.title : "Highlight Reel"}
                      </span>
                      <span className="text-xs text-gray-600">
                        {formatDate(r.created_at)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-600">
                      <span>
                        Status:{" "}
                        <span className="font-medium">
                          {r.status.toUpperCase()}
                        </span>
                      </span>
                      {isCompleted && (
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                            r.is_public
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {r.is_public ? (
                            <>
                              <Eye className="w-3 h-3" /> Public
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3" /> Private
                            </>
                          )}
                        </span>
                      )}
                    </div>
                    {r.status === "failed" && r.error && (
                      <div className="mt-1 text-xs text-red-700">{r.error}</div>
                    )}
                  </button>

                  <div className="flex items-center gap-1">
                    {isCompleted && (
                      <Button
                        variant="outline"
                        className={`border-gray-300 ${
                          r.is_public
                            ? "text-green-600 hover:text-green-700"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                        disabled={isTogglingId === r.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePrivacy(r.id, r.is_public);
                        }}
                        aria-label={
                          r.is_public ? "Make private" : "Make public"
                        }
                        title={
                          r.is_public
                            ? "Public — visible to everyone. Click to make private."
                            : "Private — only you can see this. Click to make public."
                        }
                      >
                        {isTogglingId === r.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : r.is_public ? (
                          <Eye className="w-4 h-4" />
                        ) : (
                          <EyeOff className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="border-gray-300"
                      disabled={disableDelete}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteReel(r.id);
                      }}
                      aria-label="Delete reel"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
